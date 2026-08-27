package net.cyclecoach.app;

import android.os.Bundle;
import android.webkit.CookieManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Enable third-party cookies for authentication
        CookieManager.getInstance().setAcceptThirdPartyCookies(
                this.getBridge().getWebView(), true
        );
    }
}
