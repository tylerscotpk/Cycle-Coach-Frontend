package net.cyclecoach.app;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.webkit.CookieManager;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        CookieManager.getInstance().setAcceptThirdPartyCookies(
                this.bridge.getWebView(), true
        );
    }
}