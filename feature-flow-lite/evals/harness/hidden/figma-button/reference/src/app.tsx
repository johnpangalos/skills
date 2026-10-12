import { Button } from "./button";

const variants = ["default", "outline", "ghost"] as const;
const sizes = ["default", "sm"] as const;

// The page the Figma test opens: one enabled and one disabled Button per variant and size.
export function App() {
  return (
    <main className="grid w-fit grid-cols-2 gap-8 bg-white p-8">
      {variants.flatMap((variant) =>
        sizes.flatMap((size) => [
          <div key={`${variant}-${size}`}>
            <Button variant={variant} size={size}>
              Button
            </Button>
          </div>,
          <div key={`${variant}-${size}-disabled`}>
            <Button variant={variant} size={size} disabled>
              Button
            </Button>
          </div>,
        ]),
      )}
    </main>
  );
}
