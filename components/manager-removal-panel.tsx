'use client';

type Device={id:string;data:{name?:string;status?:string;uninstallProtection?:string;capabilities?:Record<string,string>}};
type Removal={id:string;createdAt:number;data:{deviceId:string;reason:string;status:string;expiresAt:number;errorCode?:string}};
type Props={devices:Device[];requests:Removal[];owner:boolean;busy:boolean;now:number;decide:(id:string,decision:'approved'|'rejected')=>void};
const protectionLabels:Record<string,string>={enabled:'Thiết bị báo đang bật chống gỡ',disabled:'Thiết bị báo đã tắt chống gỡ',unsupported:'Thiết bị không hỗ trợ chống gỡ',permission_required:'Chưa cấp đủ quyền chống gỡ',unknown:'Chưa có xác nhận từ thiết bị'};
const statusLabels:Record<string,string>={pending:'Chờ phụ huynh duyệt',approved:'Đã duyệt · chờ thiết bị xác nhận',rejected:'Đã từ chối',released:'Thiết bị báo đã tắt bảo vệ · đã thu hồi kết nối',failed:'Thiết bị báo không thực hiện được',expired:'Yêu cầu đã hết hạn'};

export function ManagerRemovalPanel({devices,requests,owner,busy,now,decide}:Props){
 return <section className="card">
  <h2>Yêu cầu gỡ ứng dụng</h2>
  <p className="muted">Chống gỡ cần cơ chế quản lý phù hợp của Android hoặc quyền Family Controls cho trẻ trên iOS. Cài ứng dụng thông thường chưa bảo đảm bật được chức năng này.</p>
  {devices.map(device=><div className="list-row" key={device.id}><span><strong>{device.data.name}</strong><small>{protectionLabels[device.data.uninstallProtection||'unknown']||protectionLabels.unknown}</small></span></div>)}
  {!owner&&<p className="info-box">Chỉ chủ gia đình được duyệt yêu cầu gỡ ứng dụng trên điện thoại trẻ.</p>}
  {owner&&!requests.length&&<p className="muted">Chưa nhận được yêu cầu gỡ. Ứng dụng trẻ cần hỗ trợ gửi yêu cầu và xác nhận kết quả.</p>}
  {owner&&requests.map(request=>{
   const device=devices.find(d=>d.id===request.data.deviceId);
   const status=['pending','approved'].includes(request.data.status)&&request.data.expiresAt<=now?'expired':request.data.status;
   const canRelease=device?.data.status!=='revoked'&&device?.data.capabilities?.uninstall_protection==='supported'&&device.data.uninstallProtection==='enabled';
   return <article className="device-card" key={request.id}><div>
    <strong>{device?.data.name||'Thiết bị của trẻ'}</strong><p>{request.data.reason}</p>
    <p><span className="badge sand">{statusLabels[status]||'Chưa xác định trạng thái'}</span></p>
    <small>Hết hạn: {new Date(request.data.expiresAt).toLocaleString('vi-VN')}</small>
    {status==='pending'&&<><div className="toolbar">
     <button className="button danger" disabled={busy||!canRelease} onClick={()=>{if(window.confirm('Cho phép thiết bị này tắt bảo vệ chống gỡ? Kết nối chỉ được thu hồi sau khi thiết bị xác nhận thực hiện.'))decide(request.id,'approved');}}>Cho phép gỡ</button>
     <button className="button light" disabled={busy} onClick={()=>decide(request.id,'rejected')}>Từ chối gỡ</button>
    </div>{!canRelease&&<p className="muted">Thiết bị chưa xác nhận đang bật chống gỡ hoặc kết nối đã bị thu hồi.</p>}</>}
    {status==='approved'&&<p className="muted">Phê duyệt có hiệu lực 10 phút. Chưa có xác nhận tắt bảo vệ thì chưa được coi là hoàn tất.</p>}
   </div></article>;
  })}
 </section>;
}
