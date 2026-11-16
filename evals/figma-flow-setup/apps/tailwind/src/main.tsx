import "@workers-comp/ui/styles.css";
import "./index.css";
import "./fonts.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Every file in src/pages/ is a page at /<file name>. The pages are built from Figma designs with
// @workers-comp/ui, installed from npm as any app would.
// Pages load on demand, so a page's CSS is only on the page that imports it.
const pages = import.meta.glob<{ default: () => React.JSX.Element }>("./pages/*.tsx");
const name = location.pathname.replace(/^\/|\/$/g, "");
const load = pages[`./pages/${name}.tsx`];
const Page = load ? (await load()).default : undefined;

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
