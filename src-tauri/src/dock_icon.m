#import <Cocoa/Cocoa.h>

void set_mac_dock_icon_data(const uint8_t* bytes, size_t length) {
    if (!bytes || length == 0) return;
    @autoreleasepool {
        NSData* data = [NSData dataWithBytes:bytes length:length];
        NSImage* image = [[NSImage alloc] initWithData:data];
        if (image) {
            [NSApp setApplicationIconImage:image];
        }
    }
}
