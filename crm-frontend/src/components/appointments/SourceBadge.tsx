import { Badge } from '@/components/ui/Badge';
import type { AppointmentSource } from '@/types/appointment';

interface Props {
  source: AppointmentSource;
  size?: 'sm' | 'md' | 'lg';
}

export default function SourceBadge({ source, size = 'sm' }: Props) {
  const isWhatsApp = source === 'whatsapp';

  return (
    <Badge
      variant={isWhatsApp ? 'success' : 'primary'}
      size={size}
      dot
    >
      {isWhatsApp ? 'WhatsApp' : 'Admin'}
    </Badge>
  );
}
