//
//  Generated file. Do not edit.
//

import FlutterMacOS
import Foundation

import amplify_auth_cognito
import amplify_secure_storage
import connectivity_plus
import device_info_plus
import firebase_app_check
import firebase_core
import package_info_plus

func RegisterGeneratedPlugins(registry: FlutterPluginRegistry) {
  AmplifyAuthCognitoPlugin.register(with: registry.registrar(forPlugin: "AmplifyAuthCognitoPlugin"))
  AmplifySecureStoragePlugin.register(with: registry.registrar(forPlugin: "AmplifySecureStoragePlugin"))
  ConnectivityPlusPlugin.register(with: registry.registrar(forPlugin: "ConnectivityPlusPlugin"))
  DeviceInfoPlusMacosPlugin.register(with: registry.registrar(forPlugin: "DeviceInfoPlusMacosPlugin"))
  FLTFirebaseAppCheckPlugin.register(with: registry.registrar(forPlugin: "FLTFirebaseAppCheckPlugin"))
  FLTFirebaseCorePlugin.register(with: registry.registrar(forPlugin: "FLTFirebaseCorePlugin"))
  FPPPackageInfoPlusPlugin.register(with: registry.registrar(forPlugin: "FPPPackageInfoPlusPlugin"))
}
