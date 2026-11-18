package vn.familycare.parent;

import java.net.URI;
import java.util.Locale;

/** URL decisions shared by setup and every main-frame navigation. */
public final class ManagerServerPolicy {
 private ManagerServerPolicy() {}
 public static String validateServer(String input, boolean debug) {
  try {
   URI u = new URI(input.trim());
   String host = u.getHost();
   if (host == null || u.getUserInfo() != null || u.getQuery() != null || u.getFragment() != null || u.getPort() > 65535 || u.getPort() == 0) throw new IllegalArgumentException();
   host = host.toLowerCase(Locale.ROOT);
   if (host.endsWith(".")) host = host.substring(0, host.length()-1);
   if (host.equals("supabase.co") || host.endsWith(".supabase.co")) throw new IllegalArgumentException();
   if (!"https".equals(u.getScheme()) && !(debug && "http".equals(u.getScheme()) && local(host))) throw new IllegalArgumentException();
   if (u.getRawPath() != null && !u.getRawPath().isEmpty() && !u.getRawPath().equals("/")) throw new IllegalArgumentException();
   return new URI(u.getScheme(), null, host, u.getPort(), "/", null, null).toString();
  } catch (Exception e) { throw new IllegalArgumentException("Use the root HTTPS dashboard address", e); }
 }
 private static boolean local(String host) {
  if (host.equals("localhost") || host.equals("[::1]") || host.equals("::1")) return true;
  String[] parts=host.split("\\.");
  if(parts.length!=4) return false;
  int[] ip=new int[4];
  try { for(int i=0;i<4;i++){if(!parts[i].matches("[0-9]{1,3}"))return false;ip[i]=Integer.parseInt(parts[i]);if(ip[i]>255)return false;} }catch(NumberFormatException e){return false;}
  return ip[0]==10 || ip[0]==127 || (ip[0]==192 && ip[1]==168) || (ip[0]==172 && ip[1]>=16 && ip[1]<=31);
 }
 public static boolean isManagerNavigation(String origin, String target) {
  try {
   URI o=new URI(origin), t=new URI(target);
   if(t.getUserInfo()!=null || t.getHost()==null || !o.getScheme().equals(t.getScheme()) || !o.getHost().equalsIgnoreCase(t.getHost()) || port(o)!=port(t)) return false;
   String path=t.getPath();
   if(path==null)path="/";
   // Decode before normalizing so encoded separators and dot segments cannot enter child mode.
   path=new URI(null,null,path.replace('\\','/'),null).normalize().getPath();
   if(path.contains("%"))return false;
   return !(path.equalsIgnoreCase("/child") || path.toLowerCase(Locale.ROOT).startsWith("/child/"));
  }catch(Exception e){return false;}
 }
 private static int port(URI u){return u.getPort()<0?("https".equals(u.getScheme())?443:80):u.getPort();}
}
