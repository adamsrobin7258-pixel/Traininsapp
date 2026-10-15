package com.kalethra.app

import android.util.Log
import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.metadata.Metadata
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
 * Settings → App). Deliberately small: one permission (WRITE_EXERCISE), one record type
 * (ExerciseSessionRecord), nothing is read. Reading stays with @capgo/capacitor-health.
 *
 * Every record carries a stable client record ID ("kalethra:workout:<id>"): Health Connect
 * treats a second write with the same ID as an update, never as a new session – so a retry, a
 * restart or a re-enabled sync can never create a duplicate, even without the app's own
 * bookkeeping. Logs name the kind of failure only, never times, types or IDs of the user's data.
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
    private val writePermission = HealthPermission.getWritePermission(ExerciseSessionRecord::class)

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
            val client = clientOrNull()
            if (client == null) {
                resolve(JSObject().put("granted", false))
                return@launchSafely
            }
            val granted = client.permissionController.getGrantedPermissions()
            resolve(JSObject().put("granted", granted.contains(writePermission)))
        }
    }

    @PluginMethod
    fun requestWriteAccess(call: PluginCall) {
        call.launchSafely {
            val client = clientOrNull()
            if (client == null) {
                resolve(JSObject().put("granted", false))
                return@launchSafely
            }
            if (client.permissionController.getGrantedPermissions().contains(writePermission)) {
                resolve(JSObject().put("granted", true))
                return@launchSafely
            }
            val intent = permissionContract.createIntent(context, setOf(writePermission))
            startActivityForResult(this, intent, "handleWriteAccessResult")
        }
    }

    @ActivityCallback
    private fun handleWriteAccessResult(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        // The result intent is not trusted: the granted permissions are read again.
        call.launchSafely {
            val client = clientOrNull()
            val granted = client?.permissionController?.getGrantedPermissions()
                ?.contains(writePermission) ?: false
            resolve(JSObject().put("granted", granted))
        }
    }

    /**
     * Inserts or updates one exercise session. `clientRecordId` makes the write idempotent;
     * `clientRecordVersion` (the last change in Kalethra, epoch ms) lets an edit replace the
     * earlier version. Only the type and the times are written – no title, notes or calories.
     */
    @PluginMethod
    fun writeExerciseSession(call: PluginCall) {
        val clientRecordId = call.getString("clientRecordId")
        val exerciseType = exerciseTypeOf(call.getString("exerciseType"))
        val version = call.getDouble("clientRecordVersion")?.toLong() ?: 0L
        if (clientRecordId.isNullOrBlank() || exerciseType == null) {
            call.reject("Invalid record", "invalid")
            return
        }
        val start: Instant
        val end: Instant
        try {
            start = Instant.parse(call.getString("start"))
            end = Instant.parse(call.getString("end"))
        } catch (e: DateTimeParseException) {
            call.reject("Invalid record", "invalid")
            return
        } catch (e: NullPointerException) {
            call.reject("Invalid record", "invalid")
            return
        }
        if (!end.isAfter(start)) {
            call.reject("Invalid record", "invalid")
            return
        }
        call.launchSafely {
            val client = clientOrNull()
            if (client == null) {
                reject("Health Connect unavailable", "unavailable")
                return@launchSafely
            }
            val zone = ZoneId.systemDefault().rules
            val record = ExerciseSessionRecord(
                startTime = start,
                startZoneOffset = zone.getOffset(start),
                endTime = end,
                endZoneOffset = zone.getOffset(end),
                exerciseType = exerciseType,
                metadata = Metadata.manualEntry(
                    clientRecordId = clientRecordId,
                    clientRecordVersion = version,
                ),
            )
            client.insertRecords(listOf(record))
            resolve(JSObject().put("written", true))
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
    }
}
