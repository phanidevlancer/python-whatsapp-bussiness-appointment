import Cosmic404 from '@/components/ui/cosmic-404';

export default function NotFound() {
  return (
    <Cosmic404
      title="Appointment page not found"
      description="The page you requested does not exist or is no longer available in the CRM."
      backText="Back to appointments"
      backHref="/appointments"
    />
  );
}
