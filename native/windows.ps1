$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
function Emit($v) { [Console]::Write(($v | ConvertTo-Json -Depth 8 -Compress)) }
try {
 $r = [Console]::In.ReadToEnd() | ConvertFrom-Json
 switch ($r.task) {
  {$_ -in 'audioList','audioSet'} {
   Add-Type -TypeDefinition ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($env:TTISLAND_AUDIO_SOURCE))) -ErrorAction Stop
   if ($r.task -eq 'audioSet') { [TTIsland.Native.Audio]::Select([string]$r.id) }
   Emit @{ok=$true;devices=@([TTIsland.Native.Audio]::List() | ForEach-Object { @{id=$_.Id;name=$_.Name;isDefault=$_.IsDefault} })};break
  }
  'battery' {
   $warnings = New-Object System.Collections.Generic.List[string]
   $all = @();$enumMethod='PnpDevice'
   try { $all=@(Get-PnpDevice -PresentOnly -ErrorAction Stop) } catch {
    $warnings.Add('Get-PnpDevice: '+$_.Exception.Message)
    $enumMethod='CIM fallback'
    try { $all=@(Get-CimInstance -ClassName Win32_PnPEntity -OperationTimeoutSec 12 -ErrorAction Stop | ForEach-Object {[pscustomobject]@{InstanceId=$_.PNPDeviceID;FriendlyName=$_.Name;Class=$_.PNPClass;Status=$_.Status}}) } catch {throw ('Не удалось перечислить устройства Windows (PnP и CIM). '+$_.Exception.Message)}
   }
   $all=@($all | Where-Object {$_.InstanceId})
   $lookup=@{};foreach($d in $all){$lookup[[string]$d.InstanceId]=$d}
   $properties=@();$propertyErrors=@();$started=[DateTime]::UtcNow
   if (Get-Command Get-PnpDeviceProperty -ErrorAction SilentlyContinue) {
    # Query the battery key across ALL classes: headsets may expose it on System/HID nodes.
    $ids=@($all | ForEach-Object {[string]$_.InstanceId})
    for($i=0;$i -lt $ids.Count;$i+=64){
     if(([DateTime]::UtcNow-$started).TotalSeconds -gt 35){$warnings.Add('Поиск остановлен по лимиту времени; показаны найденные данные.');break}
     $batch=@($ids[$i..([Math]::Min($i+63,$ids.Count-1))])
     try {$properties+=@(Get-PnpDeviceProperty -InstanceId $batch -KeyName '{104EA319-6EE2-4701-BD47-8DDBF425BBE5} 2' -ErrorAction SilentlyContinue -ErrorVariable +propertyErrors)} catch {$warnings.Add('Часть свойств PnP недоступна: '+$_.Exception.Message)}
    }
   } else { $warnings.Add('Команда Get-PnpDeviceProperty отсутствует. Процент заряда прочитать нельзя; показан только список устройств.') }
   $items=@();$known=@{}
   foreach($p in $properties){
    if($null -eq $p.Data -or $p.Type -eq 'Empty'){continue};$n=0
    if(-not [int]::TryParse([string]$p.Data,[ref]$n) -or $n -lt 0 -or $n -gt 100){continue}
    $id=[string]$p.InstanceId;$d=$lookup[$id];$name=if($d -and $d.FriendlyName){[string]$d.FriendlyName}else{'Bluetooth-устройство'}
    $items+=@{name=$name;level=$n;status=[string]$d.Status;source='Windows battery property'};$known[$name]=$true
   }
   foreach($d in $all){
    # Keep paired Bluetooth peripherals without inventing a level; ignore adapters/enumerators.
    if($d.InstanceId -notmatch '^BTH(ENUM|LEDEVICE|LE)\\' -or -not $d.FriendlyName){continue}
    $name=[string]$d.FriendlyName;if($known.ContainsKey($name)){continue};$known[$name]=$true
    $items+=@{name=$name;level=$null;status=[string]$d.Status;source='PnP peripheral'}
   }
   if(-not $items.Count){$warnings.Add('Windows не вернула ни процент заряда, ни подходящие узлы Bluetooth. Проверь подключение и системные настройки Bluetooth.')}
   # Missing battery keys on unrelated devices are normal, not a fatal Windows error.
   Emit @{ok=$true;devices=@($items | Sort-Object name,level -Unique);readAt=[DateTime]::UtcNow.ToString('o');warnings=@($warnings.ToArray());diagnostics=@{enumeration=$enumMethod;scanned=$all.Count;properties=$properties.Count;missingOrDenied=$propertyErrors.Count;seconds=[Math]::Round(([DateTime]::UtcNow-$started).TotalSeconds,1)}};break
  }
  'ocr' {
   Add-Type -AssemblyName System.Runtime.WindowsRuntime
   $null=[Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime]
   $null=[Windows.Storage.FileAccessMode,Windows.Storage,ContentType=WindowsRuntime]
   $null=[Windows.Storage.Streams.IRandomAccessStream,Windows.Storage.Streams,ContentType=WindowsRuntime]
   $null=[Windows.Graphics.Imaging.BitmapDecoder,Windows.Graphics.Imaging,ContentType=WindowsRuntime]
   $null=[Windows.Graphics.Imaging.BitmapPixelFormat,Windows.Graphics.Imaging,ContentType=WindowsRuntime]
   $null=[Windows.Graphics.Imaging.BitmapAlphaMode,Windows.Graphics.Imaging,ContentType=WindowsRuntime]
   $null=[Windows.Graphics.Imaging.SoftwareBitmap,Windows.Graphics.Imaging,ContentType=WindowsRuntime]
   $null=[Windows.Media.Ocr.OcrEngine,Windows.Foundation,ContentType=WindowsRuntime]
   $null=[Windows.Media.Ocr.OcrResult,Windows.Foundation,ContentType=WindowsRuntime]
   $null=[Windows.Globalization.Language,Windows.Globalization,ContentType=WindowsRuntime]
   $asTask=[System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {$_.Name -eq 'AsTask' -and $_.IsGenericMethodDefinition -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'} | Select-Object -First 1
   function Await($op,[Type]$type) { $t=$asTask.MakeGenericMethod($type).Invoke($null,@($op));if(-not $t.Wait(15000)){throw 'Время ожидания OCR истекло'};return $t.GetAwaiter().GetResult() }
   if ($r.language -and $r.language -ne 'auto') { $languageObject=New-Object -TypeName Windows.Globalization.Language -ArgumentList ([string]$r.language);$engine=[Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($languageObject) } else {$engine=[Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()}
   if (-not $engine) {throw 'Нет подходящего языка OCR. Установите распознавание текста для русского или английского языка в настройках Windows.'}
   $stream=$null;$bitmap=$null;$converted=$null
   try {
    $file=Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync([string]$r.path)) ([Windows.Storage.StorageFile])
    $stream=Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
    $decoder=Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $bitmap=Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $converted=[Windows.Graphics.Imaging.SoftwareBitmap]::Convert($bitmap,[Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8,[Windows.Graphics.Imaging.BitmapAlphaMode]::Ignore)
    $result=Await ($engine.RecognizeAsync($converted)) ([Windows.Media.Ocr.OcrResult])
    $text=(@($result.Lines | ForEach-Object {$_.Text}) -join "`n")
    Emit @{ok=$true;text=$text;language=$engine.RecognizerLanguage.LanguageTag}
   } finally {if($converted){$converted.Dispose()};if($bitmap){$bitmap.Dispose()};if($stream){$stream.Dispose()}}
   break
  }
  default {throw 'Неизвестная операция'}
 }
} catch {Emit @{ok=$false;error=([string]$_.Exception.Message)}}
