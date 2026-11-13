$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
[Console]::InputEncoding=New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
function Emit($v){[Console]::Write(($v | ConvertTo-Json -Depth 6 -Compress))}
try {
 $r=[Console]::In.ReadToEnd() | ConvertFrom-Json
 if($r.task -eq 'wirelessScan'){
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $null=[Windows.UI.ViewManagement.ProjectionManager,Windows.UI.ViewManagement,ContentType=WindowsRuntime]
  $null=[Windows.Devices.Enumeration.DeviceInformation,Windows.Devices.Enumeration,ContentType=WindowsRuntime]
  $null=[Windows.Devices.Enumeration.DeviceInformationCollection,Windows.Devices.Enumeration,ContentType=WindowsRuntime]
  $selector=[Windows.UI.ViewManagement.ProjectionManager]::GetDeviceSelector()
  if([string]::IsNullOrWhiteSpace($selector)){throw 'Windows не предоставила фильтр беспроводных экранов'}
  $method=[System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {$_.Name -eq 'AsTask' -and $_.IsGenericMethodDefinition -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'} | Select-Object -First 1
  if(-not $method){throw 'Компонент Windows Runtime недоступен'}
  $operation=[Windows.Devices.Enumeration.DeviceInformation]::FindAllAsync([string]$selector)
  $task=$method.MakeGenericMethod([Windows.Devices.Enumeration.DeviceInformationCollection]).Invoke($null,@($operation))
  if(-not $task.Wait(25000)){throw 'Поиск Windows занял слишком много времени; открой системную панель подключения'}
  $found=$task.GetAwaiter().GetResult()
  $items=New-Object System.Collections.Generic.List[object]
  foreach($d in $found){if($d.Name){$items.Add(@{name=[string]$d.Name;enabled=[bool]$d.IsEnabled})}}
  Emit @{ok=$true;devices=@($items.ToArray());message='Результаты Windows могут отличаться от системного списка Win+K.'}
 } elseif($r.task -in @('wirelessConnect','wirelessMode')) {
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class TTIslandProjectionShortcut {
 [DllImport("user32.dll")] private static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
 public static void Open(byte key) {
  const byte win=0x5B; const uint up=0x0002;
  keybd_event(win,0,0,UIntPtr.Zero);
  try { keybd_event(key,0,0,UIntPtr.Zero); keybd_event(key,0,up,UIntPtr.Zero); }
  finally { keybd_event(win,0,up,UIntPtr.Zero); }
 }
}
'@
  # The caller chooses one of two fixed shortcuts; no input is interpolated.
  $key=if($r.task -eq 'wirelessConnect'){0x4B}else{0x50}
  [TTIslandProjectionShortcut]::Open([byte]$key)
  Emit @{ok=$true;message='Команда отправлена Windows'}
 } else { Emit @{ok=$false;error='Операция запрещена'} }
}catch { Emit @{ok=$false;error=('Windows не выполнила запрос: '+$_.Exception.Message)} }
