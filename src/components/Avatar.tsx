import { initials } from '../utils';

export default function Avatar({ name, photo, size = 44 }: { name: string; photo?: string; size?: number }) {
  const style = { width: size, height: size, fontSize: size * 0.38 };
  if (photo) {
    return <img className="avatar" src={photo} alt={name} style={style} />;
  }
  return (
    <div className="avatar avatar-initials" style={style}>
      {initials(name) || '?'}
    </div>
  );
}
