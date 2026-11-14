$ErrorActionPreference='Stop'
[Console]::InputEncoding=New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
function Emit($v){[Console]::Write(($v|ConvertTo-Json -Depth 5 -Compress))}
$engine=$null
try{
 $r=[Console]::In.ReadToEnd()|ConvertFrom-Json
 Add-Type -AssemblyName System.Speech
 $recognizers=@([System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers())
 $languages=@($recognizers|ForEach-Object {$_.Culture.Name}|Select-Object -Unique)
 if($r.task -eq 'speechInfo'){Emit @{ok=$true;languages=$languages;engine='Windows System.Speech (offline)'};return}
 $selected=$recognizers|Where-Object {$_.Culture.Name -eq [string]$r.language}|Select-Object -First 1
 if(-not $selected){throw ('Нет установленного офлайн-движка речи '+[string]$r.language+'. Доступны: '+($languages -join ', ')+'. Win+H использует другой движок: его можно вызвать для диктовки в поле заметки. Установка языкового пакета не всегда добавляет System.Speech.')}
 $engine=New-Object System.Speech.Recognition.SpeechRecognitionEngine -ArgumentList $selected
 $grammar=New-Object System.Speech.Recognition.DictationGrammar
 $engine.LoadGrammar($grammar)
 $engine.SetInputToWaveFile([string]$r.path)
 $engine.InitialSilenceTimeout=[TimeSpan]::FromSeconds(6)
 $engine.BabbleTimeout=[TimeSpan]::FromSeconds(4)
 $pieces=New-Object System.Collections.Generic.List[string]
 $watch=[Diagnostics.Stopwatch]::StartNew()
 while($watch.Elapsed.TotalSeconds -lt 70){$result=$engine.Recognize();if($null -eq $result){break};if($result.Text){$pieces.Add([string]$result.Text)}}
 Emit @{ok=$true;text=($pieces -join ' ');language=[string]$r.language;engine='Windows System.Speech (offline)';warnings=@('Точность зависит от установленного движка. Проверь текст перед сохранением.')}
}catch{Emit @{ok=$false;error=[string]$_.Exception.Message}}finally{if($engine){$engine.Dispose()}}
