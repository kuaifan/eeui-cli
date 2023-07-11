package eeui.android.PluginDemo.component;

import android.content.Context;
import android.graphics.Color;
import android.util.Log;
import android.widget.TextView;

import androidx.annotation.NonNull;

import com.taobao.weex.WXSDKInstance;
import com.taobao.weex.ui.action.BasicComponentData;
import com.taobao.weex.ui.component.WXComponent;
import com.taobao.weex.ui.component.WXComponentProp;
import com.taobao.weex.ui.component.WXVContainer;

public class PluginDemoComponent extends WXComponent<TextView> {
    TextView textView;

    public PluginDemoComponent(WXSDKInstance instance, WXVContainer parent, BasicComponentData basicComponentData) {
        super(instance, parent, basicComponentData);
    }

    @Override
    protected TextView initComponentHostView(@NonNull Context context) {
        textView = new TextView(context);
        textView.setTextSize(20);
        textView.setTextColor(Color.GREEN);
        return textView;
    }


    @WXComponentProp(name = "tel")
    public void setTel(String telNumber) {
        textView.setText("tel: " + telNumber);
    }
}
