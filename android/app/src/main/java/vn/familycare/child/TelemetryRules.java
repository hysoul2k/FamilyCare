package vn.familycare.child;
/** Consent and retention decisions used by every telemetry entry point. */
public final class TelemetryRules {
 public static boolean mayShare(String consent){return "true".equals(consent);}
 public static boolean hasRoom(int count){return count<15000;}
 public static String eventProblem(long capturedAt,long now){
  if(capturedAt<now-30L*86400000)return "EXPIRED";
  if(capturedAt>now+300000)return "FUTURE_TIMESTAMP";
  return null;
 }
 public static boolean permanentRejection(int status){return status==400 || status==413 || status==422;}
}
