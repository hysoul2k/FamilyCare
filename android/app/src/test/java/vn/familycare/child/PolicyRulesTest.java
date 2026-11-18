package vn.familycare.child;
import java.util.*;
public final class PolicyRulesTest {
 public static void main(String[] args) {
  if (!PolicyRules.inWindow(60, "22:00", "07:00")) throw new AssertionError("overnight");
  if (PolicyRules.inWindow(800, "22:00", "07:00")) throw new AssertionError("daytime");
  Set<String> blocked = PolicyRules.blocked(new HashSet<>(Arrays.asList("dialer","game","study")),new HashSet<>(Arrays.asList("dialer")),new HashSet<>(Arrays.asList("dialer","game")),true,Collections.emptySet());
  if (blocked.contains("dialer") || !blocked.contains("study")) throw new AssertionError("essential precedence and quota");
  if (PolicyRules.delta(1000,900)!=0 || PolicyRules.delta(1000,1600)!=600) throw new AssertionError("incremental usage");
  if(PolicyRules.dailyLimit(120,30,"2026-11-05","2026-11-05")!=150)throw new AssertionError("bonus today");
  if(PolicyRules.dailyLimit(120,30,"2026-11-05","2026-11-06")!=120)throw new AssertionError("bonus expires offline");
  if(PolicyRules.addMinutes(Double.NaN,0.5)!=0.5)throw new AssertionError("first unseen app starts at zero, not JSON NaN");
  if(PolicyRules.addMinutes(2.0,0.5)!=2.5)throw new AssertionError("usage accumulates");
  if(TelemetryRules.mayShare("false") || TelemetryRules.mayShare(null))throw new AssertionError("stop and missing consent deny telemetry");
  if(!TelemetryRules.mayShare("true"))throw new AssertionError("explicit sharing enables telemetry");
  long now=1800000000000L;
  if(!"EXPIRED".equals(TelemetryRules.eventProblem(now-31L*86400000,now)))throw new AssertionError("stale queue entry must expire");
  if(TelemetryRules.eventProblem(now-1000,now)!=null)throw new AssertionError("valid backlog survives");
  if(!"FUTURE_TIMESTAMP".equals(TelemetryRules.eventProblem(now+600001,now)))throw new AssertionError("invalid future event quarantined");
  if(TelemetryRules.hasRoom(15000) || !TelemetryRules.hasRoom(14999))throw new AssertionError("bounded queue");
  if(!TelemetryRules.permanentRejection(422) || TelemetryRules.permanentRejection(503) || TelemetryRules.permanentRejection(401))throw new AssertionError("transient/auth errors never discard queued events");
  System.out.println("Safety core: 16 assertions passed");
 }
}
