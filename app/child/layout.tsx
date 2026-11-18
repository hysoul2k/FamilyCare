import type {Metadata} from 'next';
export const metadata:Metadata={title:'Family Care · Không gian dành cho con',manifest:'/child/manifest.webmanifest',appleWebApp:{capable:true,title:'Cùng con',statusBarStyle:'default'},icons:{apple:'/icon-192.png'}};
export default function ChildLayout({children}:{children:React.ReactNode}){return children;}
