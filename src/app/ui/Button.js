// Button UI Component
// This is a placeholder for a reusable button component

export default function Button({ label, onClick, variant = 'primary' }) {
  return {
    label,
    onClick,
    variant,
    type: 'button'
  };
}
