package com.kalethra.app

import android.util.Log
import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.metadata.Metadata
import androidx.health.connect.client.units.Energy
import androidx.health.connect.client.units.Length
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeParseException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * Writes Kalethra's own exercise sessions to Health Connect (the "Health Connect" setting under
 * Settings → App), plus – where Kalethra has a real value – the active calories and the distance
 * of the same time span. Deliberately small: three write permissions (WRITE_EXERCISE,
 * WRITE_ACTIVE_CALORIES_BURNED, WRITE_DISTANCE), nothing is read. Reading stays with
 * @capgo/capacitor-health.
 *
 * Every record carries a stable client record ID ("kalethra:workout:<id>",
 * "kalethra:activity:<id>:calories"): Health Connect treats a second write with the same ID as an
 * update, never as a new record – so a retry, a restart or a re-enabled sync can never create a
 * duplicate, even without the app's own bookkeeping. The only delete is of Kalethra's own amount
 * record by that ID. Logs name the kind of failure only, never values, times or IDs.
 */
@CapacitorPlugin(name = "KalethraHealthExport")
class HealthExportPlugin : Plugin() {
    private val scope = CoroutineScope(
        SupervisorJob() + Dispatchers.Main.immediate +
            CoroutineExceptionHandler { _, throwable ->
                Log.e(TAG, "Unhandled failure: ${throwable.javaClass.simpleName}")
            },
    )
    private val permissionContract = PermissionController.createRequestPermissionResultContract()
    /** The write permission per record type, keyed like `HealthWriteType` in export.ts. */
    private val writePermissions = linkedMapOf(
        "exercise" to HealthPermission.getWritePermission(ExerciseSessionRecord::class),
        "activeCalories" to HealthPermission.getWritePermission(ActiveCaloriesBurnedRecord::class),
        "distance" to HealthPermission.getWritePermission(DistanceRecord::class),
    )

    private fun accessOf(granted: Set<String>): JSObject {
        val access = JSObject()
        writePermissions.forEach { (type, permission) -> access.put(type, granted.contains(permission)) }
        return access
    }

    override fun handleOnDestroy() {
        super.handleOnDestroy()
        scope.cancel()
    }

    /** Settles the call on every failure – a Health Connect error must never crash the app. */
    private fun PluginCall.launchSafely(block: suspend PluginCall.() -> Unit) {
        val call = this
        scope.launch {
            try {
                call.block()
            } catch (e: CancellationException) {
                throw e
            } catch (e: SecurityException) {
                Log.w(TAG, "Health Connect refused the write: missing permission")
                call.reject("Permission missing", "permission")
            } catch (e: IllegalArgumentException) {
                Log.w(TAG, "Health Connect rejected the record as invalid")
                call.reject("Invalid record", "invalid")
            } catch (e: Throwable) {
                Log.w(TAG, "Health Connect call failed: ${e.javaClass.simpleName}")
                call.reject("Health Connect call failed", "failed")
            }
        }
    }

    private fun clientOrNull(): HealthConnectClient? =
        if (HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE) {
            HealthConnectClient.getOrCreate(context)
        } else {
            null
        }

    @PluginMethod
    fun availability(call: PluginCall) {
        val status = when (HealthConnectClient.getSdkStatus(context)) {
            HealthConnectClient.SDK_AVAILABLE -> "available"
            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "needsInstall"
            else -> "unsupported"
        }
        call.resolve(JSObject().put("status", status))
    }

    @PluginMethod
    fun checkWriteAccess(call: PluginCall) {
        call.launchSafely {
            val granted = clientOrNull()?.permissionController?.getGrantedPermissions() ?: emptySet()
            resolve(accessOf(granted))
        }
    }

    /** Asks only for the write permissions not granted yet. */
    @PluginMethod
    fun requestWriteAccess(call: PluginCall) {
        call.launchSafely {
            val client = clientOrNull()
            if (client == null) {
                resolve(accessOf(emptySet()))
                return@launchSafely
            }
            val granted = client.permissionController.getGrantedPermissions()
            val missing = writePermissions.values.filterNot { granted.contains(it) }.toSet()
            if (missing.isEmpty()) {
                resolve(accessOf(granted))
                return@launchSafely
            }
            val intent = permissionContract.createIntent(context, missing)
            startActivityForResult(this, intent, "handleWriteAccessResult")
        }
    }

    @ActivityCallback
    private fun handleWriteAccessResult(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        // The result intent is not trusted: the granted permissions are read again.
        call.launchSafely {
            val granted = clientOrNull()?.permissionController?.getGrantedPermissions() ?: emptySet()
            resolve(accessOf(granted))
        }
    }

    /** Client record ID, version and time span shared by every record Kalethra writes. */
    private class Span(
        val clientRecordId: String,
        val version: Long,
        val start: Instant,
        val end: Instant,
    ) {
        val metadata: Metadata
            get() = Metadata.manualEntry(clientRecordId = clientRecordId, clientRecordVersion = version)
    }

    /** Reads the shared fields; rejects the call as invalid and returns null when one is wrong. */
    private fun spanOf(call: PluginCall): Span? {
        val clientRecordId = call.getString("clientRecordId")
        val version = call.getDouble("clientRecordVersion")?.toLong() ?: 0L
        val span = try {
            val start = Instant.parse(call.getString("start"))
            val end = Instant.parse(call.getString("end"))
            if (clientRecordId.isNullOrBlank() || !end.isAfter(start)) {
                null
            } else {
                Span(clientRecordId, version, start, end)
            }
        } catch (e: DateTimeParseException) {
            null
        } catch (e: NullPointerException) {
            null
        }
        if (span == null) call.reject("Invalid record", "invalid")
        return span
    }

    /** Inserts or updates records on a background-safe coroutine; settles the call. */
    private fun PluginCall.insert(build: () -> androidx.health.connect.client.records.Record) {
        launchSafely {
            val client = clientOrNull()
            if (client == null) {
                reject("Health Connect unavailable", "unavailable")
                return@launchSafely
            }
            client.insertRecords(listOf(build()))
            resolve(JSObject().put("written", true))
        }
    }

    /**
     * Inserts or updates one exercise session. `clientRecordId` makes the write idempotent;
     * `clientRecordVersion` lets an edit replace the earlier version. Only the type and the times
     * are written – no title or notes.
     */
    @PluginMethod
    fun writeExerciseSession(call: PluginCall) {
        val exerciseType = exerciseTypeOf(call.getString("exerciseType"))
        if (exerciseType == null) {
            call.reject("Invalid record", "invalid")
            return
        }
        val span = spanOf(call) ?: return
        val zone = ZoneId.systemDefault().rules
        call.insert {
            ExerciseSessionRecord(
                startTime = span.start,
                startZoneOffset = zone.getOffset(span.start),
                endTime = span.end,
                endZoneOffset = zone.getOffset(span.end),
                exerciseType = exerciseType,
                metadata = span.metadata,
            )
        }
    }

    /** Active energy (kcal, without resting energy) over the span of a session. */
    @PluginMethod
    fun writeActiveCalories(call: PluginCall) {
        val kcal = call.getDouble("kcal")
        if (kcal == null || !kcal.isFinite() || kcal <= 0.0 || kcal > MAX_KCAL) {
            call.reject("Invalid record", "invalid")
            return
        }
        val span = spanOf(call) ?: return
        val zone = ZoneId.systemDefault().rules
        call.insert {
            ActiveCaloriesBurnedRecord(
                startTime = span.start,
                startZoneOffset = zone.getOffset(span.start),
                endTime = span.end,
                endZoneOffset = zone.getOffset(span.end),
                energy = Energy.kilocalories(kcal),
                metadata = span.metadata,
            )
        }
    }

    /** A distance (metres) logged in Kalethra, over the span of a session. */
    @PluginMethod
    fun writeDistance(call: PluginCall) {
        val meters = call.getDouble("meters")
        if (meters == null || !meters.isFinite() || meters <= 0.0 || meters > MAX_METERS) {
            call.reject("Invalid record", "invalid")
            return
        }
        val span = spanOf(call) ?: return
        val zone = ZoneId.systemDefault().rules
        call.insert {
            DistanceRecord(
                startTime = span.start,
                startZoneOffset = zone.getOffset(span.start),
                endTime = span.end,
                endZoneOffset = zone.getOffset(span.end),
                distance = Length.meters(meters),
                metadata = span.metadata,
            )
        }
    }

    /**
     * Deletes one of Kalethra's own amount records by its client record ID – a value that was
     * removed in Kalethra. Only IDs starting with "kalethra:" are accepted; Health Connect itself
     * only deletes records this app wrote. A missing record is not an error.
     */
    @PluginMethod
    fun deleteAmount(call: PluginCall) {
        val clientRecordId = call.getString("clientRecordId")
        val type = when (call.getString("type")) {
            "activeCalories" -> ActiveCaloriesBurnedRecord::class
            "distance" -> DistanceRecord::class
            else -> null
        }
        if (type == null || clientRecordId.isNullOrBlank() || !clientRecordId.startsWith("kalethra:")) {
            call.reject("Invalid record", "invalid")
            return
        }
        call.launchSafely {
            val client = clientOrNull()
            if (client == null) {
                reject("Health Connect unavailable", "unavailable")
                return@launchSafely
            }
            client.deleteRecords(
                recordType = type,
                recordIdsList = emptyList(),
                clientRecordIdsList = listOf(clientRecordId),
            )
            resolve(JSObject().put("deleted", true))
        }
    }

    /** The Health Connect types Kalethra writes – an unknown name is never mapped. */
    private fun exerciseTypeOf(name: String?): Int? = when (name) {
        "strengthTraining" -> ExerciseSessionRecord.EXERCISE_TYPE_STRENGTH_TRAINING
        "weightlifting" -> ExerciseSessionRecord.EXERCISE_TYPE_WEIGHTLIFTING
        "calisthenics" -> ExerciseSessionRecord.EXERCISE_TYPE_CALISTHENICS
        "running" -> ExerciseSessionRecord.EXERCISE_TYPE_RUNNING
        "walking" -> ExerciseSessionRecord.EXERCISE_TYPE_WALKING
        "hiking" -> ExerciseSessionRecord.EXERCISE_TYPE_HIKING
        "biking" -> ExerciseSessionRecord.EXERCISE_TYPE_BIKING
        "bikingStationary" -> ExerciseSessionRecord.EXERCISE_TYPE_BIKING_STATIONARY
        "stretching" -> ExerciseSessionRecord.EXERCISE_TYPE_STRETCHING
        "yoga" -> ExerciseSessionRecord.EXERCISE_TYPE_YOGA
        "pilates" -> ExerciseSessionRecord.EXERCISE_TYPE_PILATES
        "highIntensityIntervalTraining" ->
            ExerciseSessionRecord.EXERCISE_TYPE_HIGH_INTENSITY_INTERVAL_TRAINING
        "rowing" -> ExerciseSessionRecord.EXERCISE_TYPE_ROWING
        "rowingMachine" -> ExerciseSessionRecord.EXERCISE_TYPE_ROWING_MACHINE
        "paddling" -> ExerciseSessionRecord.EXERCISE_TYPE_PADDLING
        "surfing" -> ExerciseSessionRecord.EXERCISE_TYPE_SURFING
        "tennis" -> ExerciseSessionRecord.EXERCISE_TYPE_TENNIS
        "badminton" -> ExerciseSessionRecord.EXERCISE_TYPE_BADMINTON
        "tableTennis" -> ExerciseSessionRecord.EXERCISE_TYPE_TABLE_TENNIS
        "squash" -> ExerciseSessionRecord.EXERCISE_TYPE_SQUASH
        "soccer" -> ExerciseSessionRecord.EXERCISE_TYPE_SOCCER
        "basketball" -> ExerciseSessionRecord.EXERCISE_TYPE_BASKETBALL
        "volleyball" -> ExerciseSessionRecord.EXERCISE_TYPE_VOLLEYBALL
        "handball" -> ExerciseSessionRecord.EXERCISE_TYPE_HANDBALL
        "iceHockey" -> ExerciseSessionRecord.EXERCISE_TYPE_ICE_HOCKEY
        "elliptical" -> ExerciseSessionRecord.EXERCISE_TYPE_ELLIPTICAL
        "stairClimbing" -> ExerciseSessionRecord.EXERCISE_TYPE_STAIR_CLIMBING
        "boxing" -> ExerciseSessionRecord.EXERCISE_TYPE_BOXING
        "martialArts" -> ExerciseSessionRecord.EXERCISE_TYPE_MARTIAL_ARTS
        "skiing" -> ExerciseSessionRecord.EXERCISE_TYPE_SKIING
        "snowboarding" -> ExerciseSessionRecord.EXERCISE_TYPE_SNOWBOARDING
        "iceSkating" -> ExerciseSessionRecord.EXERCISE_TYPE_ICE_SKATING
        "skating" -> ExerciseSessionRecord.EXERCISE_TYPE_SKATING
        "snowshoeing" -> ExerciseSessionRecord.EXERCISE_TYPE_SNOWSHOEING
        "dancing" -> ExerciseSessionRecord.EXERCISE_TYPE_DANCING
        "rockClimbing" -> ExerciseSessionRecord.EXERCISE_TYPE_ROCK_CLIMBING
        "golf" -> ExerciseSessionRecord.EXERCISE_TYPE_GOLF
        "otherWorkout" -> ExerciseSessionRecord.EXERCISE_TYPE_OTHER_WORKOUT
        else -> null
    }

    companion object {
        private const val TAG = "KalethraHealthExport"

        /** Upper bounds well inside what Health Connect accepts; Kalethra's own are lower. */
        private const val MAX_KCAL = 100_000.0
        private const val MAX_METERS = 1_000_000.0
    }
}
