const state = {
  cameras: [],
  events: [],
  direction: "entry",
  lastSnapshot: null,
};

const elements = {
  errorBox: document.querySelector("#errorBox"),
  refreshButton: document.querySelector("#refreshButton"),
  currentTime: document.querySelector("#currentTime"),
  cameraForm: document.querySelector("#cameraForm"),
  cameraName: document.querySelector("#cameraName"),
  streamUrl: document.querySelector("#streamUrl"),
  cameraList: document.querySelector("#cameraList"),
  eventList: document.querySelector("#eventList"),
  totalCount: document.querySelector("#totalCount"),
  entryCount: document.querySelector("#entryCount"),
  exitCount: document.querySelector("#exitCount"),
  snapshotPreview: document.querySelector("#snapshotPreview"),
  snapshotTitle: document.querySelector("#snapshotTitle"),
  snapshotImage: document.querySelector("#snapshotImage"),
  snapshotLink: document.querySelector("#snapshotLink"),
  directionButtons: document.querySelectorAll("[data-direction]"),
};

async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

function showError(message) {
  elements.errorBox.textContent = message;
  elements.errorBox.classList.remove("hidden");
}

function clearError() {
  elements.errorBox.textContent = "";
  elements.errorBox.classList.add("hidden");
}

async function refresh() {
  clearError();
  try {
    const [cameras, events] = await Promise.all([request("/api/cameras"), request("/api/events")]);
    state.cameras = cameras;
    state.events = events;
    render();
  } catch (error) {
    showError(error.message || "Gagal mengambil data");
  }
}

function render() {
  const entryCount = state.events.filter((event) => event.direction === "entry").length;
  const exitCount = state.events.filter((event) => event.direction === "exit").length;

  elements.totalCount.textContent = String(state.events.length);
  elements.entryCount.textContent = String(entryCount);
  elements.exitCount.textContent = String(exitCount);
  renderCameras();
  renderEvents();
  renderSnapshot();
}

function renderCameras() {
  if (state.cameras.length === 0) {
    elements.cameraList.innerHTML = '<p class="empty">Belum ada kamera.</p>';
    return;
  }

  elements.cameraList.innerHTML = state.cameras
    .map(
      (camera) => `
        <article class="camera-row">
          <div>
            <strong>${escapeHtml(camera.name)}</strong>
            <span>${camera.direction === "entry" ? "Masuk" : "Keluar"} | ${camera.status}</span>
          </div>
          <div class="camera-actions">
            <button type="button" class="text-button" data-snapshot-camera="${camera.id}" title="Ambil foto dan baca plat">Foto & Baca Plat</button>
            <button type="button" class="icon-button" data-toggle-camera="${camera.id}" title="${camera.status === "active" ? "Stop CCTV" : "Start CCTV"}">
              ${camera.status === "active" ? "Stop" : "Play"}
            </button>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderEvents() {
  if (state.events.length === 0) {
    elements.eventList.innerHTML = '<p class="empty">Belum ada kendaraan tercatat.</p>';
    return;
  }

  elements.eventList.innerHTML = state.events
    .map(
      (event) => `
        <div class="event-row">
          <span>${new Date(event.created_at).toLocaleString("id-ID")}</span>
          <span>${escapeHtml(event.camera_name)}</span>
          <span>${event.direction === "entry" ? "Masuk" : "Keluar"}</span>
          <strong>${escapeHtml(event.plate_number)}</strong>
          <a href="/${event.snapshot_path.replaceAll("\\", "/")}" target="_blank">Lihat foto</a>
        </div>
      `,
    )
    .join("");
}

function renderSnapshot() {
  if (!state.lastSnapshot) {
    elements.snapshotPreview.classList.add("hidden");
    return;
  }

  const imageUrl = `/${state.lastSnapshot.snapshot_path.replaceAll("\\", "/")}?t=${Date.now()}`;
  elements.snapshotTitle.textContent = `${state.lastSnapshot.camera_name} | Plat: ${
    state.lastSnapshot.plate_number || "UNKNOWN"
  } | ${state.lastSnapshot.confidence || 0}%`;
  elements.snapshotImage.src = imageUrl;
  elements.snapshotLink.href = imageUrl;
  elements.snapshotPreview.classList.remove("hidden");
}

async function saveCamera(event) {
  event.preventDefault();
  clearError();

  try {
    await request("/api/cameras", {
      method: "POST",
      body: JSON.stringify({
        name: elements.cameraName.value,
        stream_url: elements.streamUrl.value,
        direction: state.direction,
      }),
    });
    await refresh();
  } catch (error) {
    showError(error.message || "Gagal menyimpan kamera");
  }
}

async function captureSnapshot(cameraId) {
  clearError();
  const photoTab = window.open("about:blank", "_blank");

  if (photoTab) {
    photoTab.document.write("<p style=\"font-family: sans-serif; padding: 16px;\">Mengambil foto kamera...</p>");
  }

  try {
    state.lastSnapshot = await request(`/api/cameras/${cameraId}/snapshot`, { method: "POST" });
    renderSnapshot();
    const imageUrl = `/${state.lastSnapshot.snapshot_path.replaceAll("\\", "/")}?t=${Date.now()}`;

    if (photoTab) {
      photoTab.location.href = imageUrl;
    } else {
      window.open(imageUrl, "_blank");
    }
    await refresh();
  } catch (error) {
    if (photoTab) {
      photoTab.close();
    }
    showError(error.message || "Gagal mengambil foto dari kamera");
  }
}

async function toggleCamera(cameraId) {
  const camera = state.cameras.find((item) => item.id === cameraId);
  if (!camera) return;

  clearError();
  try {
    await request(`/api/cameras/${cameraId}/${camera.status === "active" ? "stop" : "start"}`, { method: "POST" });
    await refresh();
  } catch (error) {
    showError(error.message || "Gagal mengubah status kamera");
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

elements.directionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.direction = button.dataset.direction;
    elements.directionButtons.forEach((item) => item.classList.toggle("selected", item === button));
  });
});

elements.cameraList.addEventListener("click", (event) => {
  const snapshotButton = event.target.closest("[data-snapshot-camera]");
  if (snapshotButton) {
    captureSnapshot(Number(snapshotButton.dataset.snapshotCamera));
    return;
  }

  const button = event.target.closest("[data-toggle-camera]");
  if (!button) return;
  toggleCamera(Number(button.dataset.toggleCamera));
});

elements.cameraForm.addEventListener("submit", saveCamera);
elements.refreshButton.addEventListener("click", refresh);

function updateClock() {
  if (!elements.currentTime) return;
  elements.currentTime.textContent = new Date().toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

updateClock();
window.setInterval(updateClock, 1000);
refresh();
window.setInterval(refresh, 5000);
