package vn.familycare.parent;
public final class ManagerServerPolicyTest {
 public static void main(String[] args) {
  check("https://example.org/".equals(ManagerServerPolicy.validateServer("https://example.org", false)));
  for (String value : new String[]{"https://a.supabase.co", "https://u:p@example.org", "https://example.org/child", "https://example.org/base", "https://example.org?q=1", "https://example.org#x", "http://example.org", "http://192.168.1.2"}) reject(value, false);
  check(ManagerServerPolicy.validateServer("http://192.168.1.2:3000",true)!=null);
  check(ManagerServerPolicy.validateServer("http://localhost:3000",true)!=null);
  reject("http://public.example",true);
  check(ManagerServerPolicy.isManagerNavigation("https://example.org/", "https://example.org/settings?q=1"));
  for(String target:new String[]{"https://example.org/child", "https://example.org/child/a", "https://example.org/%63hild", "https://example.org/a/../child", "https://example.org/child%2Fa", "https://other.org/", "javascript:alert(1)"}) check(!ManagerServerPolicy.isManagerNavigation("https://example.org/",target));
  System.out.println("ManagerServerPolicy: all assertions passed");
 }
 static void reject(String value,boolean debug){try{ManagerServerPolicy.validateServer(value,debug);throw new AssertionError(value);}catch(IllegalArgumentException expected){}}
 static void check(boolean value){if(!value)throw new AssertionError();}
}
