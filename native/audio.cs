using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
namespace TTIsland.Native {
 [ComImport,Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMEnumerator {}
 [ComImport,Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IEnum {
  [PreserveSig] int EnumAudioEndpoints(int flow,uint mask,out ICollection devices);
  [PreserveSig] int GetDefaultAudioEndpoint(int flow,int role,out IDevice device);
  [PreserveSig] int GetDevice([MarshalAs(UnmanagedType.LPWStr)]string id,out IDevice device);
  [PreserveSig] int RegisterEndpointNotificationCallback(IntPtr p);
  [PreserveSig] int UnregisterEndpointNotificationCallback(IntPtr p);
 }
 [ComImport,Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface ICollection {
  [PreserveSig] int GetCount(out uint count); [PreserveSig] int Item(uint index,out IDevice device);
 }
 [ComImport,Guid("D666063F-1587-4E43-81F1-B948E807363F"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IDevice {
  [PreserveSig] int Activate(ref Guid iid,uint ctx,IntPtr param,out IntPtr result);
  [PreserveSig] int OpenPropertyStore(int access,out IStore properties);
  [PreserveSig] int GetId([MarshalAs(UnmanagedType.LPWStr)]out string id);
  [PreserveSig] int GetState(out uint state);
 }
 [StructLayout(LayoutKind.Sequential)] struct Key {public Guid fmtid;public uint pid;public Key(Guid id,uint p){fmtid=id;pid=p;}}
 [StructLayout(LayoutKind.Explicit,Size=24)] struct Variant { [FieldOffset(0)] public ushort vt;[FieldOffset(8)] public IntPtr str; }
 [ComImport,Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IStore {
  [PreserveSig] int GetCount(out uint count);[PreserveSig] int GetAt(uint index,out Key key);[PreserveSig] int GetValue(ref Key key,out Variant value);
  [PreserveSig] int SetValue(ref Key key,ref Variant value);[PreserveSig] int Commit();
 }
 // Undocumented Windows PolicyConfig vtable. Only SetDefaultEndpoint is invoked.
 [ComImport,Guid("870AF99C-171D-4F9E-AF0D-E63DF40C2BC9")] class PolicyConfig {}
 [ComImport,Guid("F8679F50-850A-41CF-9C72-430F290290C8"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IPolicy {
  [PreserveSig] int GetMixFormat();[PreserveSig] int GetDeviceFormat();[PreserveSig] int ResetDeviceFormat();[PreserveSig] int SetDeviceFormat();
  [PreserveSig] int GetProcessingPeriod();[PreserveSig] int SetProcessingPeriod();[PreserveSig] int GetShareMode();[PreserveSig] int SetShareMode();
  [PreserveSig] int GetPropertyValue();[PreserveSig] int SetPropertyValue();
  [PreserveSig] int SetDefaultEndpoint([MarshalAs(UnmanagedType.LPWStr)]string id,int role);
  [PreserveSig] int SetEndpointVisibility([MarshalAs(UnmanagedType.LPWStr)]string id,int visible);
 }
 public class Endpoint {public string Id;public string Name;public bool IsDefault;}
 public static class Audio {
  [DllImport("ole32.dll")] static extern int PropVariantClear(ref Variant value);
  static void Check(int hr){Marshal.ThrowExceptionForHR(hr);}
  static void Release(object value){if(value!=null&&Marshal.IsComObject(value))Marshal.ReleaseComObject(value);}
  static string Default(IEnum e,int role){IDevice d=null;try{if(e.GetDefaultAudioEndpoint(0,role,out d)<0)return "";string id;Check(d.GetId(out id));return id;}finally{Release(d);}}
  public static Endpoint[] List(){IEnum e=null;ICollection c=null;var items=new List<Endpoint>();try{e=(IEnum)new MMEnumerator();string current=Default(e,1);Check(e.EnumAudioEndpoints(0,1,out c));uint count;Check(c.GetCount(out count));for(uint i=0;i<count;i++){IDevice d=null;IStore store=null;try{Check(c.Item(i,out d));string id;Check(d.GetId(out id));string name="Аудиоустройство";Check(d.OpenPropertyStore(0,out store));var key=new Key(new Guid("A45C254E-DF1C-4EFD-8020-67D146A850E0"),14);Variant value;Check(store.GetValue(ref key,out value));try{if(value.vt==31&&value.str!=IntPtr.Zero)name=Marshal.PtrToStringUni(value.str);}finally{PropVariantClear(ref value);}items.Add(new Endpoint{Id=id,Name=name,IsDefault=id==current});}finally{Release(store);Release(d);}}return items.ToArray();}finally{Release(c);Release(e);}}
  public static void Select(string id){bool found=false;foreach(var d in List())if(d.Id==id)found=true;if(!found)throw new InvalidOperationException("Устройство недоступно. Обновите список.");IEnum e=null;IPolicy p=null;try{e=(IEnum)new MMEnumerator();string oldConsole=Default(e,0),oldMedia=Default(e,1);p=(IPolicy)new PolicyConfig();try{Check(p.SetDefaultEndpoint(id,0));Check(p.SetDefaultEndpoint(id,1));}catch{if(oldConsole!="")p.SetDefaultEndpoint(oldConsole,0);if(oldMedia!="")p.SetDefaultEndpoint(oldMedia,1);throw;}if(Default(e,1)!=id)throw new InvalidOperationException("Windows не подтвердила переключение.");}finally{Release(p);Release(e);}}
 }
}
