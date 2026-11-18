package vn.familycare.child;
import java.util.*;
/** Platform independent safety rules shared by on-device enforcement and tests. */
public final class PolicyRules {
 public static boolean inWindow(int minute, String start, String end) {
  int s=parse(start), e=parse(end);
  return s==e || (s<e ? minute>=s && minute<e : minute>=s || minute<e);
 }
 private static int parse(String time) { String[] p=time.split(":"); return Integer.parseInt(p[0])*60+Integer.parseInt(p[1]); }
 public static long delta(long previous, long current) { return Math.max(0,current-previous); }
 public static double dailyLimit(double base,double bonus,String allowanceDate,String today){ return base+(today.equals(allowanceDate)?Math.max(0,bonus):0); }
 public static double addMinutes(double previous,double delta){return (Double.isFinite(previous)?Math.max(0,previous):0)+Math.max(0,delta);}
 public static Set<String> blocked(Set<String> installed, Set<String> essential, Set<String> explicit, boolean quota, Set<String> scheduleAllowed) {
  Set<String> result=new HashSet<>(explicit);
  if(quota) result.addAll(installed);
  if(scheduleAllowed!=null) { Set<String> restricted=new HashSet<>(installed); restricted.removeAll(scheduleAllowed); result.addAll(restricted); }
  result.retainAll(installed); result.removeAll(essential); return result;
 }
}
