//
//  PluginDemoComponent.m
//  fzqDatepicker
//
//  Created by Hitosea-005 on 2021/4/12.
//

#import "PluginDemoComponent.h"
#import <WeexPluginLoader/WeexPluginLoader.h>

@implementation PluginDemoComponent

//Tips: 不能导出同步方法，因为主线程线程会等待
WX_PlUGIN_EXPORT_COMPONENT(PluginDemo, PluginDemoComponent)
WX_EXPORT_METHOD(@selector(animate))//导出方法

-(instancetype)initWithRef:(NSString *)ref type:(NSString *)type styles:(NSDictionary *)styles attributes:(NSDictionary *)attributes events:(NSArray *)events weexInstance:(WXSDKInstance *)weexInstance{
    self = [super initWithRef:ref type:type styles:styles attributes:attributes events:events weexInstance:weexInstance];
    if (self) {
        //初始化不会渲染视图 必须到viewdidload中渲染才会生效
        self.color = attributes[@"color"];
    }
    return self;
}

//初始化完成调用
-(void)viewDidLoad{
    [super viewDidLoad];
    
    self.view.backgroundColor = [UIColor redColor];
    //如何向前端发送时间
    [self fireEvent:@"load" params:@{@"key":@"value"}];
    
    self.view.backgroundColor = [UIColor blackColor];
}

- (void)animate{
    self.view.backgroundColor = [UIColor blackColor];
}

//升级属性时需要手动渲染 nodejs只提供交互不提供渲染服务
-(void)updateAttributes:(NSDictionary *)attributes{
    [super updateAttributes:attributes];
    self.color = attributes[@"color"];
    
    self.view.backgroundColor = [UIColor whiteColor];
}
@end
