$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
[Console]::InputEncoding=New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
function Emit($v){[Console]::Write(($v|ConvertTo-Json -Depth 7 -Compress))}
try {
 $null=[Console]::In.ReadToEnd()
 Add-Type -AssemblyName System.Runtime.WindowsRuntime
 $null=[Windows.Devices.Enumeration.DeviceInformation,Windows.Devices.Enumeration,ContentType=WindowsRuntime]
 $null=[Windows.Devices.Enumeration.DeviceInformationCollection,Windows.Devices.Enumeration,ContentType=WindowsRuntime]
 $null=[Windows.Devices.Enumeration.DeviceInformationKind,Windows.Devices.Enumeration,ContentType=WindowsRuntime]
 $asTask=[System.WindowsRuntimeSystemExtensions].GetMethods()|Where-Object {$_.Name -eq 'AsTask' -and $_.IsGenericMethodDefinition -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'}|Select-Object -First 1
 function Await($operation){$task=$asTask.MakeGenericMethod([Windows.Devices.Enumeration.DeviceInformationCollection]).Invoke($null,@($operation));if(-not $task.Wait(12000)){throw 'Bluetooth: превышено время ожидания Windows'};return ,($task.GetAwaiter().GetResult())}
 function Prop($props,$key){try{return $props[$key]}catch{return $null}}
 $props=[string[]]@('System.Devices.Aep.IsConnected','System.Devices.Aep.ContainerId')
 $filter='System.Devices.Aep.ProtocolId:="{e0cbf06c-cd8b-4647-bb8a-263b43f0f974}" AND System.Devices.Aep.IsPaired:=System.StructuredQueryType.Boolean#True'
 $found=Await ([Windows.Devices.Enumeration.DeviceInformation]::FindAllAsync($filter,$props,[Windows.Devices.Enumeration.DeviceInformationKind]::AssociationEndpoint))
 $rows=New-Object System.Collections.Generic.List[object]
 $warnings=New-Object System.Collections.Generic.List[string]
 $cache=@{};$started=[DateTime]::UtcNow;$nodesRead=0
 foreach($d in $found){
  if(-not $d.Name){continue}
  $connectedValue=Prop $d.Properties 'System.Devices.Aep.IsConnected'
  $connected=if($null -eq $connectedValue){$null}else{[bool]$connectedValue}
  $container=Prop $d.Properties 'System.Devices.Aep.ContainerId'
  $level=$null
  if($connected -and $container){
   $key=([string]$container).Trim('{}')
   if(-not $cache.ContainsKey($key)){
    if(([DateTime]::UtcNow-$started).TotalSeconds -gt 38){$warnings.Add('Достигнут лимит поиска заряда. Обнови список для повторной попытки.');break}
    try{
     $nodeFilter='System.Devices.ContainerId:="{'+$key+'}"'
     $nodes=Await ([Windows.Devices.Enumeration.DeviceInformation]::FindAllAsync($nodeFilter,[string[]]@('{104EA319-6EE2-4701-BD47-8DDBF425BBE5} 2'),[Windows.Devices.Enumeration.DeviceInformationKind]::Device))
     $n=$null
     foreach($node in $nodes){$nodesRead++;$value=Prop $node.Properties '{104EA319-6EE2-4701-BD47-8DDBF425BBE5} 2';$number=0;if($null -ne $value -and [int]::TryParse([string]$value,[ref]$number) -and $number -ge 0 -and $number -le 100){$n=$number;break}}
     $cache[$key]=$n
    }catch{$cache[$key]=$null;$warnings.Add('Заряд части устройств недоступен: '+$_.Exception.Message)}
   }
   $level=$cache[$key]
  }
  $rows.Add(@{name=[string]$d.Name;connected=$connected;level=$level;status=$(if($connected){'Подключено'}elseif($null -eq $connected){'Статус неизвестен'}else{'Не подключено'});source='WinRT association endpoint + ContainerId'})
 }
 if(-not $rows.Count){$warnings.Add('Сопряжённые устройства Classic Bluetooth не найдены. BLE-only устройства могут не входить в этот список.')}
 if(@($rows|Where-Object {$_.connected -and $null -eq $_.level}).Count){$warnings.Add('Windows пока не сообщает заряд некоторых устройств. После подключения подожди несколько секунд и обнови список. Заряд кейса и отдельных наушников доступен не у всех моделей.')}
 Emit @{ok=$true;devices=@($rows.ToArray()|Sort-Object @{Expression='connected';Descending=$true},name);readAt=[DateTime]::UtcNow.ToString('o');warnings=@($warnings.ToArray());diagnostics=@{enumeration='WinRT AssociationEndpoint + ContainerId';scanned=$found.Count;nodes=$nodesRead;seconds=[Math]::Round(([DateTime]::UtcNow-$started).TotalSeconds,1)}}
}catch{Emit @{ok=$false;error=('Не удалось прочитать Bluetooth через WinRT: '+$_.Exception.Message);diagnostic=@{code='BLUETOOTH_WINRT';type=$_.Exception.GetType().FullName}}}
