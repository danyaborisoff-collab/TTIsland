$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
[Console]::InputEncoding=New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
function Emit($v){[Console]::Write(($v|ConvertTo-Json -Depth 10 -Compress))}
function InitWinRT {
 Add-Type -AssemblyName System.Runtime.WindowsRuntime
 $script:asTask=[System.WindowsRuntimeSystemExtensions].GetMethods()|Where-Object {$_.Name -eq 'AsTask' -and $_.IsGenericMethodDefinition -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'}|Select-Object -First 1
}
function Await($op,[Type]$type){$t=$script:asTask.MakeGenericMethod($type).Invoke($null,@($op));if(-not $t.Wait(18000)){throw 'Windows не ответила вовремя'};return $t.GetAwaiter().GetResult()}
function BluetoothRadios {
 $null=[Windows.Devices.Radios.Radio,Windows.System.Devices,ContentType=WindowsRuntime]
 $null=[Windows.Devices.Radios.RadioAccessStatus,Windows.System.Devices,ContentType=WindowsRuntime]
 $null=[Windows.Devices.Radios.RadioState,Windows.System.Devices,ContentType=WindowsRuntime]
 return @(Await ([Windows.Devices.Radios.Radio]::GetRadiosAsync()) ([System.Collections.Generic.IReadOnlyList[Windows.Devices.Radios.Radio]])|Where-Object {$_.Kind.ToString() -eq 'Bluetooth'})
}
function VpnList {
 $items=@();try{$items+=@(Get-VpnConnection -ErrorAction Stop)}catch{}
 try{$items+=@(Get-VpnConnection -AllUserConnection -ErrorAction Stop)}catch{}
 return @($items|Sort-Object Name -Unique|ForEach-Object {@{name=$_.Name;connected=$_.ConnectionStatus.ToString() -eq 'Connected';server=$_.ServerAddress;tunnel=$_.TunnelType.ToString()}})
}
function AppearanceState {
 $key='HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize';$theme=Get-ItemProperty -Path $key -ErrorAction SilentlyContinue
 $notification=Get-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\PushNotifications' -ErrorAction SilentlyContinue
 return @{ok=$true;appsLight=($null -eq $theme.AppsUseLightTheme -or $theme.AppsUseLightTheme -ne 0);systemLight=($null -eq $theme.SystemUsesLightTheme -or $theme.SystemUsesLightTheme -ne 0);notifications=($null -eq $notification.ToastEnabled -or $notification.ToastEnabled -ne 0)}
}
try {
 $r=[Console]::In.ReadToEnd()|ConvertFrom-Json
 if($r.task -like 'wifi*'){
  Add-Type -Path (Join-Path $env:TTISLAND_NATIVE_DIR 'wifi.cs')
  switch($r.task){
   'wifiSnapshot' {Emit @{ok=$true;state=[TTIsland.Native.Wifi]::Snapshot([bool]$r.scan)}}
   'wifiPower' {Emit @{ok=$true;state=[TTIsland.Native.Wifi]::Power([string]$r.adapterId,[bool]$r.value)}}
   'wifiConnect' {try{[TTIsland.Native.Wifi]::Connect([string]$r.adapterId,[string]$r.ssidHex,[string]$r.profile,[string]$r.password,[bool]$r.remember)}finally{$r.password=$null};Emit @{ok=$true;state=[TTIsland.Native.Wifi]::Snapshot($false)}}
   'wifiDisconnect' {[TTIsland.Native.Wifi]::Disconnect([string]$r.adapterId);Start-Sleep -Milliseconds 400;Emit @{ok=$true;state=[TTIsland.Native.Wifi]::Snapshot($false)}}
   'wifiForget' {[TTIsland.Native.Wifi]::Forget([string]$r.adapterId,[string]$r.profile);Emit @{ok=$true;state=[TTIsland.Native.Wifi]::Snapshot($false)}}
   default{throw 'Операция Wi-Fi запрещена'}
  };exit
 }
 switch($r.task){
  {$_ -in 'bluetoothState','bluetoothPower','bluetoothPair','bluetoothUnpair'} {
   InitWinRT
   $radios=@(BluetoothRadios)
   if($r.task -eq 'bluetoothPower'){
    if(-not $radios.Count){throw 'Bluetooth-адаптер не найден'}
    $access=Await ([Windows.Devices.Radios.Radio]::RequestAccessAsync()) ([Windows.Devices.Radios.RadioAccessStatus])
    if($access.ToString() -ne 'Allowed'){throw ('Windows не разрешила управление Bluetooth: '+$access)}
    foreach($radio in $radios){$next=if($r.value){[Windows.Devices.Radios.RadioState]::On}else{[Windows.Devices.Radios.RadioState]::Off};$result=Await ($radio.SetStateAsync($next)) ([Windows.Devices.Radios.RadioAccessStatus]);if($result.ToString() -ne 'Allowed'){throw ('Windows отклонила переключение Bluetooth: '+$result)}}
   }
   $null=[Windows.Devices.Enumeration.DeviceInformation,Windows.Devices.Enumeration,ContentType=WindowsRuntime]
   $null=[Windows.Devices.Enumeration.DeviceInformationCollection,Windows.Devices.Enumeration,ContentType=WindowsRuntime]
   $null=[Windows.Devices.Bluetooth.BluetoothDevice,Windows.Devices.Bluetooth,ContentType=WindowsRuntime]
   $null=[Windows.Devices.Enumeration.DevicePairingResult,Windows.Devices.Enumeration,ContentType=WindowsRuntime]
   $null=[Windows.Devices.Enumeration.DeviceUnpairingResult,Windows.Devices.Enumeration,ContentType=WindowsRuntime]
   if($r.task -in 'bluetoothPair','bluetoothUnpair'){
    $device=Await ([Windows.Devices.Enumeration.DeviceInformation]::CreateFromIdAsync([string]$r.id)) ([Windows.Devices.Enumeration.DeviceInformation])
    if(-not $device){throw 'Устройство больше не доступно'}
    if($r.task -eq 'bluetoothPair'){$paired=Await ($device.Pairing.PairAsync()) ([Windows.Devices.Enumeration.DevicePairingResult]);if($paired.Status.ToString() -notin 'Paired','AlreadyPaired'){throw ('Сопряжение не завершено: '+$paired.Status)}}else{$unpaired=Await ($device.Pairing.UnpairAsync()) ([Windows.Devices.Enumeration.DeviceUnpairingResult]);if($unpaired.Status.ToString() -notin 'Unpaired','AlreadyUnpaired'){throw ('Устройство не удалено: '+$unpaired.Status)}}
   }
   $items=@();foreach($paired in @($true,$false)){
    $selector=[Windows.Devices.Bluetooth.BluetoothDevice]::GetDeviceSelectorFromPairingState($paired)
    $found=Await ([Windows.Devices.Enumeration.DeviceInformation]::FindAllAsync([string]$selector)) ([Windows.Devices.Enumeration.DeviceInformationCollection])
    foreach($d in $found){if($d.Name){$items+=@{id=[string]$d.Id;name=[string]$d.Name;paired=[bool]$d.Pairing.IsPaired;canPair=[bool]$d.Pairing.CanPair}}}
   }
   $states=@(BluetoothRadios|ForEach-Object {@{name=$_.Name;state=$_.State.ToString()}})
   Emit @{ok=$true;radios=$states;devices=@($items|Sort-Object id -Unique);note='Список устройств, обнаруженных Windows. Для поиска включи режим сопряжения на устройстве.'};break
  }
  'networkState' {
   $items=@(Get-NetIPConfiguration -ErrorAction Stop|Where-Object {$_.NetAdapter.Status -eq 'Up'}|ForEach-Object {@{name=$_.InterfaceAlias;description=$_.InterfaceDescription;ipv4=@($_.IPv4Address|ForEach-Object {$_.IPAddress});gateway=@($_.IPv4DefaultGateway|ForEach-Object {$_.NextHop});dns=@($_.DNSServer.ServerAddresses);index=$_.InterfaceIndex}})
   Emit @{ok=$true;interfaces=$items};break
  }
  'vpnState' {Emit @{ok=$true;connections=@(VpnList)};break}
  {$_ -in 'vpnConnect','vpnDisconnect'} {
   $list=@(VpnList);if(-not ($list|Where-Object {$_.name -ceq [string]$r.name})){throw 'Сохранённое VPN-подключение Windows не найдено'}
   $exe=Join-Path $env:SystemRoot 'System32\rasdial.exe'
   if($r.task -eq 'vpnDisconnect'){$output=& $exe ([string]$r.name) '/DISCONNECT' 2>&1}else{$output=& $exe ([string]$r.name) 2>&1}
   if($LASTEXITCODE -ne 0){throw ('Windows VPN: код '+$LASTEXITCODE+'. Для подключения нужен профиль с сохранёнными учётными данными. Сторонние VPN-клиенты этим интерфейсом не управляются.')}
   Emit @{ok=$true;connections=@(VpnList)};break
  }
  'appearanceState' {Emit (AppearanceState);break}
  'appearanceSet' {
   $key='HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize'
   if($r.target -eq 'notifications'){$key='HKCU:\Software\Microsoft\Windows\CurrentVersion\PushNotifications';$name='ToastEnabled'}elseif($r.target -eq 'appsLight'){$name='AppsUseLightTheme'}elseif($r.target -eq 'systemLight'){$name='SystemUsesLightTheme'}else{throw 'Недопустимая настройка'}
   if(-not (Test-Path -Path $key)){$null=New-Item -Path $key -Force};$null=New-ItemProperty -Path $key -Name $name -Value ([int][bool]$r.value) -PropertyType DWord -Force
   Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class TTIslandSettingsBroadcast {
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]static extern IntPtr SendMessageTimeout(IntPtr h,uint m,UIntPtr w,string l,uint f,uint t,out UIntPtr r);
 public static void Notify(){UIntPtr result;SendMessageTimeout(new IntPtr(0xffff),0x1a,UIntPtr.Zero,"ImmersiveColorSet",2,1000,out result);}
}
'@
   [TTIslandSettingsBroadcast]::Notify();Emit (AppearanceState);break
  }
  'privacyState' {
   $items=@();foreach($kind in @('microphone','webcam')){
    $key='Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\'+$kind
    $user=Get-ItemProperty -Path ('HKCU:\'+$key) -ErrorAction SilentlyContinue;$machine=Get-ItemProperty -Path ('HKLM:\'+$key) -ErrorAction SilentlyContinue
    $items+=@{kind=$kind;user=[string]$user.Value;machine=[string]$machine.Value}
   };Emit @{ok=$true;permissions=$items;note='Информация из хранилища согласий Windows; окончательный доступ зависит от политик и разрешений приложений. Программа не подменяет системное согласие.'};break
  }
  {$_ -in 'audioState','audioVolume','audioMute'} {
   Add-Type -Path (Join-Path $env:TTISLAND_NATIVE_DIR 'audio-mixer.cs')
   if($r.task -eq 'audioVolume'){[TTIsland.Native.Mixer]::Volume([int]$r.flow,[float]$r.value)}
   if($r.task -eq 'audioMute'){[TTIsland.Native.Mixer]::Mute([int]$r.flow,[bool]$r.value)}
   Emit @{ok=$true;output=[TTIsland.Native.Mixer]::State(0);input=[TTIsland.Native.Mixer]::State(1)};break
  }
  default {throw 'Операция запрещена'}
 }
}catch {
 $message=$_.Exception.Message
 if($_.Exception.InnerException){$message=$_.Exception.InnerException.Message}
 Emit @{ok=$false;error=$message}
}
