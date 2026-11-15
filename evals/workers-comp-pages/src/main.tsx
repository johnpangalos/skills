import "@workers-comp/ui/styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Every file in src/pages/ is a page at /<file name>. The pages are built from Figma designs with
// @workers-comp/ui, installed from npm as any app would.
const pages = import.meta.glob<{ default: () => React.JSX.Element }>("./pages/*.tsx", { eager: true });
const name = location.pathname.replace(/^\/|\/$/g, "");
const Page = pages[`./pages/${name}.tsx`]?.default;

function Index() {
  return (
    <ul>
      {Object.keys(pages).map((path) => {
        const page = path.slice("./pages/".length, -".tsx".length);
        return (
          <li key={page}>
            <a href={`/${page}`}>{page}</a>
          </li>
        );
      })}
    </ul>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode>{Page ? <Page /> : <Index />}</StrictMode>);
