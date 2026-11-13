using System;
using System.Runtime.InteropServices;
namespace TTIsland.Native {
 [ComImport,Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]class MixerEnumerator{}
 [ComImport,Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]interface IMixerEnumerator {
  [PreserveSig]int EnumAudioEndpoints(int flow,uint mask,out IntPtr devices);
  [PreserveSig]int GetDefaultAudioEndpoint(int flow,int role,out IMixerDevice device);
  [PreserveSig]int GetDevice([MarshalAs(UnmanagedType.LPWStr)]string id,out IMixerDevice device);
  [PreserveSig]int RegisterEndpointNotificationCallback(IntPtr value);[PreserveSig]int UnregisterEndpointNotificationCallback(IntPtr value);
 }
 [ComImport,Guid("D666063F-1587-4E43-81F1-B948E807363F"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]interface IMixerDevice {
  [PreserveSig]int Activate(ref Guid iid,uint ctx,IntPtr param,out IEndpointVolume result);
  [PreserveSig]int OpenPropertyStore(int access,out IntPtr store);[PreserveSig]int GetId([MarshalAs(UnmanagedType.LPWStr)]out string id);[PreserveSig]int GetState(out uint state);
 }
 [ComImport,Guid("5CDF2C82-841E-4546-9722-0CF74078229A"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]interface IEndpointVolume {
  [PreserveSig]int RegisterControlChangeNotify(IntPtr p);[PreserveSig]int UnregisterControlChangeNotify(IntPtr p);[PreserveSig]int GetChannelCount(out uint n);
  [PreserveSig]int SetMasterVolumeLevel(float db,ref Guid context);[PreserveSig]int SetMasterVolumeLevelScalar(float value,ref Guid context);[PreserveSig]int GetMasterVolumeLevel(out float db);[PreserveSig]int GetMasterVolumeLevelScalar(out float value);
  [PreserveSig]int SetChannelVolumeLevel(uint ch,float db,ref Guid context);[PreserveSig]int SetChannelVolumeLevelScalar(uint ch,float value,ref Guid context);[PreserveSig]int GetChannelVolumeLevel(uint ch,out float db);[PreserveSig]int GetChannelVolumeLevelScalar(uint ch,out float value);
  [PreserveSig]int SetMute([MarshalAs(UnmanagedType.Bool)]bool value,ref Guid context);[PreserveSig]int GetMute([MarshalAs(UnmanagedType.Bool)]out bool value);
 }
 public class MixerState {public bool available;public int volume;public bool muted;public string error;}
 public static class Mixer {
  static void Release(object v){if(v!=null&&Marshal.IsComObject(v))Marshal.ReleaseComObject(v);}
  static T With<T>(int flow,Func<IEndpointVolume,T> action){if(flow!=0&&flow!=1)throw new ArgumentException("Некорректное устройство");IMixerEnumerator e=null;IMixerDevice d=null;IEndpointVolume v=null;try{e=(IMixerEnumerator)new MixerEnumerator();Marshal.ThrowExceptionForHR(e.GetDefaultAudioEndpoint(flow,1,out d));Guid id=new Guid("5CDF2C82-841E-4546-9722-0CF74078229A");Marshal.ThrowExceptionForHR(d.Activate(ref id,23,IntPtr.Zero,out v));return action(v);}finally{Release(v);Release(d);Release(e);}}
  public static MixerState State(int flow){try{return With(flow,delegate(IEndpointVolume v){float level;bool muted;Marshal.ThrowExceptionForHR(v.GetMasterVolumeLevelScalar(out level));Marshal.ThrowExceptionForHR(v.GetMute(out muted));return new MixerState{available=true,volume=(int)Math.Round(level*100),muted=muted};});}catch{return new MixerState{available=false,error=flow==1?"Микрофон по умолчанию недоступен":"Аудиовыход по умолчанию недоступен"};}}
  public static void Volume(int flow,float percent){if(float.IsNaN(percent)||percent<0||percent>100)throw new ArgumentException("Громкость должна быть 0–100");With(flow,delegate(IEndpointVolume v){Guid context=Guid.Empty;Marshal.ThrowExceptionForHR(v.SetMasterVolumeLevelScalar(percent/100,ref context));return true;});}
  public static void Mute(int flow,bool muted){With(flow,delegate(IEndpointVolume v){Guid context=Guid.Empty;Marshal.ThrowExceptionForHR(v.SetMute(muted,ref context));return true;});}
 }
}
