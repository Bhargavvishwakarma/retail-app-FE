import { notificationIcon } from '../../utils/notificationUtils';

const paths = {
  stock: <><path d="M4 8.25 10 5l6 3.25v7.5L10 19l-6-3.25v-7.5Z" /><path d="m4.25 8.5 5.75 3.25 5.75-3.25M10 11.75V19" /></>,
  out: <><path d="M10 3.5 18 17.25a1.25 1.25 0 0 1-1.08 1.88H3.08A1.25 1.25 0 0 1 2 17.25L10 3.5Z" /><path d="M10 8v4.75M10 15.75v.1" /></>,
  sale: <><path d="M4 4.5h12v12H4z" /><path d="M7 8.25h6M7 11.5h4.25M13.25 15.5l2.5-2.5-2.5-2.5" /></>,
  purchase: <><path d="M4.25 6.25h11.5v10.5H4.25z" /><path d="M7 6.25V4.5h6v1.75M7.25 10h5.5M10 8.75v2.5" /></>,
  payment: <><path d="M3.5 6.25h13v9.5h-13z" /><path d="M3.5 9h13M6 12.5h2" /></>,
  customer: <><circle cx="10" cy="7" r="2.75" /><path d="M4.75 17.25c.58-3 2.24-4.5 5.25-4.5s4.67 1.5 5.25 4.5" /></>,
  system: <><path d="M10 3.5v2M10 14.5v2M3.5 10h2M14.5 10h2M5.4 5.4l1.4 1.4M13.2 13.2l1.4 1.4M14.6 5.4l-1.4 1.4M6.8 13.2l-1.4 1.4" /><circle cx="10" cy="10" r="3.25" /></>
};

export default function NotificationIcon({ type, className = '' }) {
  const icon = notificationIcon(type);
  return <svg className={`notification-icon ${className}`} viewBox="0 0 20 20" aria-hidden="true">{paths[icon] || paths.system}</svg>;
}
