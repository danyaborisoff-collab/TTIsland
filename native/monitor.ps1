$ErrorActionPreference='Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
try {
 $req=[Console]::In.ReadToEnd() | ConvertFrom-Json
 switch ($req.task) {
  'probe' {
   $gpu=$null; $gpuLoad=$null; $temperature=$null
   try {$gpu=(Get-CimInstance Win32_VideoController -ErrorAction Stop | Select-Object -First 1 -ExpandProperty Name)} catch {}
   try {
    $samples=(Get-Counter '\GPU Engine(*)\Utilization Percentage' -ErrorAction Stop).CounterSamples
    $groups=@{}; foreach($sample in $samples){$name=[string]$sample.InstanceName; $key=$name -replace 'pid_\d+_', ''; if(!$groups.ContainsKey($key)){$groups[$key]=0.0}; $groups[$key]+=[double]$sample.CookedValue}
    if($groups.Count){$max=($groups.Values | Measure-Object -Maximum).Maximum; if($max -ge 0 -and $max -le 1000){$gpuLoad=[math]::Round([math]::Min(100,$max),0)}}
   } catch {}
   try {$t=(Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction Stop | Select-Object -First 1 -ExpandProperty CurrentTemperature); $c=([double]$t/10)-273.15; if($c -ge 0 -and $c -le 110){$temperature=[math]::Round($c,0)}} catch {}
   @{ok=$true;gpu=$gpu;gpuLoad=$gpuLoad;temperature=$temperature} | ConvertTo-Json -Compress
  }
  'brightnessGet' {
   $m=Get-CimInstance -Namespace root/wmi -ClassName WmiMonitorBrightness -ErrorAction Stop | Select-Object -First 1
   if(!$m){throw 'No supported display'}
   @{ok=$true;brightness=[int]$m.CurrentBrightness} | ConvertTo-Json -Compress
  }
  'brightnessSet' {
   $v=[int]$req.value;if($v -lt 1 -or $v -gt 100){throw 'Out of range'}
   $m=Get-CimInstance -Namespace root/wmi -ClassName WmiMonitorBrightnessMethods -ErrorAction Stop | Select-Object -First 1
   if(!$m){throw 'No supported display'}
   $r=Invoke-CimMethod -InputObject $m -MethodName WmiSetBrightness -Arguments @{Brightness=[byte]$v;Timeout=[uint32]1} -ErrorAction Stop
   if($r.ReturnValue -ne 0){throw 'Unsupported'}
   @{ok=$true;brightness=$v} | ConvertTo-Json -Compress
  }
  default {throw 'Unsupported'}
 }
} catch { @{ok=$false;error='Windows не предоставляет эти данные или яркость для данного экрана.'} | ConvertTo-Json -Compress }
