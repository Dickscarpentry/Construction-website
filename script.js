(() => {
  "use strict";

  const header = document.querySelector(".site-header");
  const toggle = document.querySelector(".nav__toggle");
  const menu = document.querySelector(".nav__menu");
  const yearEl = document.getElementById("year");
  const form = document.getElementById("quote-form");
  const formStatus = document.getElementById("form-status");

  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  /* Sticky header */
  const onScroll = () => {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 24);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* Mobile nav */
  if (toggle && menu) {
    const setOpen = (open) => {
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      menu.classList.toggle("is-open", open);
      header?.classList.toggle("menu-open", open);
      document.body.style.overflow = open ? "hidden" : "";
    };

    toggle.addEventListener("click", () => {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });

    menu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => setOpen(false));
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setOpen(false);
      }
    });
  }

  /* Reveal on scroll */
  const revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  }

  /* Stat counters */
  const counters = document.querySelectorAll("[data-count]");
  const animateCount = (el) => {
    const target = Number(el.getAttribute("data-count") || 0);
    const suffix = el.getAttribute("data-suffix") || "";
    const duration = 1400;
    const start = performance.now();

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  if (counters.length && "IntersectionObserver" in window) {
    const cio = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCount(entry.target);
            cio.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 }
    );
    counters.forEach((c) => cio.observe(c));
  } else {
    counters.forEach((c) => {
      c.textContent =
        (c.getAttribute("data-count") || "") + (c.getAttribute("data-suffix") || "");
    });
  }

  /* Service card tilt (desktop only) */
  const cards = document.querySelectorAll("[data-service]");
  const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  if (canHover) {
    cards.forEach((card) => {
      card.addEventListener("pointermove", (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transform = `translateY(-6px) rotateX(${(-y * 4).toFixed(2)}deg) rotateY(${(x * 5).toFixed(2)}deg)`;
      });
      card.addEventListener("pointerleave", () => {
        card.style.transform = "";
      });
    });
  }

  /* Work carousels + lightbox */
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");
  const lightboxCaption = document.getElementById("lightbox-caption");
  let flatItems = [];
  let lightIndex = 0;

  const openLightbox = (index) => {
    if (!lightbox || !flatItems.length) return;
    lightIndex = index;
    updateLightbox();
    lightbox.hidden = false;
    document.body.classList.add("lightbox-open");
  };

  const closeLightbox = () => {
    if (!lightbox) return;
    lightbox.hidden = true;
    document.body.classList.remove("lightbox-open");
  };

  const updateLightbox = () => {
    const item = flatItems[lightIndex];
    if (!item || !lightboxImg) return;
    lightboxImg.src = item.src;
    lightboxImg.alt = item.alt || "Project photo";
    if (lightboxCaption) lightboxCaption.textContent = item.label || "";
  };

  const stepLightbox = (dir) => {
    if (!flatItems.length) return;
    lightIndex = (lightIndex + dir + flatItems.length) % flatItems.length;
    updateLightbox();
  };

  if (lightbox) {
    lightbox.querySelector(".lightbox__close")?.addEventListener("click", closeLightbox);
    lightbox.querySelector(".lightbox__nav--prev")?.addEventListener("click", () => stepLightbox(-1));
    lightbox.querySelector(".lightbox__nav--next")?.addEventListener("click", () => stepLightbox(1));
    lightbox.addEventListener("click", (e) => {
      if (e.target === lightbox) closeLightbox();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (!lightbox || lightbox.hidden) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") stepLightbox(-1);
    if (e.key === "ArrowRight") stepLightbox(1);
  });

  const fillCarousel = (sectionId, images) => {
    const root = document.querySelector(`[data-carousel="${sectionId}"]`);
    if (!root) return;

    const track = root.querySelector("[data-track]");
    if (!track) return;

    track.innerHTML = "";

    if (!images || !images.length) {
      root.classList.add("is-empty");
      root.classList.remove("is-animated");
      return;
    }

    root.classList.remove("is-empty");

    const makeSlide = (item, globalIndex) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "carousel__slide";
      btn.setAttribute("aria-label", `View ${item.label || "project"} photo`);

      const img = document.createElement("img");
      img.src = item.src;
      img.alt = item.alt || `${item.label || "Project"} photo`;
      img.loading = "lazy";
      img.draggable = false;

      const cap = document.createElement("span");
      cap.textContent = item.label || "";

      btn.appendChild(img);
      if (item.label) btn.appendChild(cap);
      btn.addEventListener("click", () => openLightbox(globalIndex));
      return btn;
    };

    // Assign global lightbox indices
    const startIndex = flatItems.length;
    images.forEach((item) => {
      flatItems.push(item);
    });

    // Double the slides for seamless loop
    const slides = images.map((item, i) => makeSlide(item, startIndex + i));
    const clones = images.map((item, i) => makeSlide(item, startIndex + i));
    [...slides, ...clones].forEach((slide) => track.appendChild(slide));

    // Duration scales with photo count (slower = more relaxed)
    const seconds = Math.max(28, images.length * 6);
    root.style.setProperty("--carousel-duration", `${seconds}s`);

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduceMotion && images.length > 1) {
      root.classList.add("is-animated");
    } else {
      root.classList.remove("is-animated");
    }
  };

  const loadShowcases = async () => {
    flatItems = [];
    let data = { sections: {} };

    // Prefer embedded data (works when opening index.html directly)
    if (window.DICKS_PORTFOLIO && window.DICKS_PORTFOLIO.sections) {
      data = window.DICKS_PORTFOLIO;
    } else {
      try {
        const res = await fetch("assets/portfolio/manifest.json", { cache: "no-store" });
        if (res.ok) data = await res.json();
      } catch {
        /* no portfolio data available */
      }
    }

    const sections = data.sections || {};
    ["painting", "carpentry", "flooring", "outdoor"].forEach((id) => {
      const list = sections[id];
      // PowerShell ConvertTo-Json may produce a single object instead of array for 1 item
      const images = !list ? [] : Array.isArray(list) ? list : [list];
      fillCarousel(id, images);
    });
  };

  loadShowcases();

  /* Quote form → WhatsApp or email */
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const channel = e.submitter?.getAttribute("data-send") || "whatsapp";

      const data = new FormData(form);
      const name = String(data.get("name") || "").trim();
      const contact = String(data.get("contact") || "").trim();
      const service = String(data.get("service") || "").trim();
      const message = String(data.get("message") || "").trim();

      if (!name || !contact || !service || !message) {
        if (formStatus) {
          formStatus.textContent = "Please fill in all fields.";
          formStatus.classList.add("is-error");
        }
        return;
      }

      const body = [
        `Hi Dick's Carpentry — quote request`,
        ``,
        `Name: ${name}`,
        `Contact: ${contact}`,
        `Service: ${service}`,
        ``,
        `Details:`,
        message,
      ].join("\n");

      if (formStatus) {
        formStatus.classList.remove("is-error");
        formStatus.textContent =
          channel === "email" ? "Opening your email app…" : "Opening WhatsApp…";
      }

      if (channel === "email") {
        const subject = encodeURIComponent(`Quote request: ${service} — ${name}`);
        window.location.href = `mailto:dickscarpentry@gmail.com?subject=${subject}&body=${encodeURIComponent(body)}`;
      } else {
        window.open(
          `https://wa.me/447368418205?text=${encodeURIComponent(body)}`,
          "_blank",
          "noopener,noreferrer"
        );
      }
    });
  }
})();
