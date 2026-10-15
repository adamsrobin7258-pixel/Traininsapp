package com.kalethra.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Kalethra's own plugin (not from npm) must be registered before the bridge starts.
        registerPlugin(HealthExportPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
