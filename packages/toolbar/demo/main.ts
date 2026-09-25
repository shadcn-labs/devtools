import { mountToolbar } from "../src";

interface Route {
  heading: string;
  title: string;
  tags: Node[];
}

const meta = (attr: "name" | "property", key: string, content: string) => {
  const el = document.createElement("meta");
  el.setAttribute(attr, key);
  el.content = content;
  el.dataset.demo = "";
  return el;
};

const ROUTES: Record<string, Route> = {
  "/": {
    heading: "Shadcn Labs devtools",
    tags: [...document.head.querySelectorAll("[data-demo]")].map((el) =>
      el.cloneNode(true)
    ),
    title: document.title,
  },
  "/blog/relative-image": {
    heading: "Needs work",
    tags: [
      meta("property", "og:type", "article"),
      meta(
        "property",
        "og:title",
        "Everything we shipped this quarter across every Shadcn Labs registry and tool"
      ),
      meta("property", "og:image", "/og.png?title=Needs%20work"),
      meta("name", "twitter:card", "summary"),
    ],
    title: "Needs work · Shadcn Labs",
  },
};

/** Swap metadata a beat after the URL changes, like a streamed RSC payload. */
const applyRoute = (pathname: string) => {
  const route = ROUTES[pathname] ?? ROUTES["/"];
  if (!route) {
    return;
  }
  window.setTimeout(() => {
    for (const el of document.head.querySelectorAll("[data-demo]")) {
      el.remove();
    }
    document.head.append(...route.tags.map((tag) => tag.cloneNode(true)));
    document.title = route.title;
    (document.querySelector("#heading") as HTMLElement).textContent =
      route.heading;
  }, 200);
};

document.addEventListener("click", (event) => {
  const link = (event.target as HTMLElement).closest<HTMLAnchorElement>(
    "a[data-route]"
  );
  if (!link) {
    return;
  }
  event.preventDefault();
  history.pushState(null, "", link.pathname);
  applyRoute(link.pathname);
});
window.addEventListener("popstate", () => applyRoute(location.pathname));
if (location.pathname !== "/") {
  applyRoute(location.pathname);
}

mountToolbar({ project: null });
