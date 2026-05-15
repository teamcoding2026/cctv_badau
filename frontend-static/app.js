const state = {
  cameras: [],
  events: [],
  direction: "entry",
  lastSnapshot: null,
  editingCameraId: null,
};

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin123";
const LOGIN_KEY = "cctvAdminLoggedIn";
let refreshTimer = null;

const elements = {
  loginScreen: document.querySelector("#loginScreen"),
  appShell: document.querySelector("#appShell"),
  loginForm: document.querySelector("#loginForm"),
  loginUsername: document.querySelector("#loginUsername"),
  loginPassword: document.querySelector("#loginPassword"),
  loginError: document.querySelector("#loginError"),
  logoutButton: document.querySelector("#logoutButton"),
  errorBox: document.querySelector("#errorBox"),
  statusBox: document.querySelector("#statusBox"),
  refreshButton: document.querySelector("#refreshButton"),
  currentTime: document.querySelector("#currentTime"),
  cameraForm: document.querySelector("#cameraForm"),
  cameraFormTitle: document.querySelector("#cameraFormTitle"),
  cameraSubmitButton: document.querySelector("#cameraSubmitButton"),
  cancelEditButton: document.querySelector("#cancelEditButton"),
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

function showStatus(message) {
  elements.statusBox.textContent = message;
  elements.statusBox.classList.remove("hidden");
  window.setTimeout(() => {
    elements.statusBox.classList.add("hidden");
  }, 3500);
}

function clearStatus() {
  elements.statusBox.textContent = "";
  elements.statusBox.classList.add("hidden");
}

function isLoggedIn() {
  return sessionStorage.getItem(LOGIN_KEY) === "true";
}

function showLoginError(message) {
  elements.loginError.textContent = message;
  elements.loginError.classList.remove("hidden");
}

function clearLoginError() {
  elements.loginError.textContent = "";
  elements.loginError.classList.add("hidden");
}

function startRefreshTimer() {
  if (refreshTimer !== null) return;
  refreshTimer = window.setInterval(refresh, 5000);
}

function stopRefreshTimer() {
  if (refreshTimer === null) return;
  window.clearInterval(refreshTimer);
  refreshTimer = null;
}

function setLoginState(loggedIn) {
  elements.loginScreen.classList.toggle("hidden", loggedIn);
  elements.appShell.classList.toggle("hidden", !loggedIn);

  if (loggedIn) {
    refresh();
    startRefreshTimer();
  } else {
    stopRefreshTimer();
    clearLoginError();
    elements.loginPassword.value = "";
    elements.loginUsername.focus();
  }
}

async function refresh() {
  if (!isLoggedIn()) return;
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
            <button type="button" class="text-button" data-edit-camera="${camera.id}" title="Edit data CCTV">Edit</button>
            <button type="button" class="icon-button" data-toggle-camera="${camera.id}" title="${camera.status === "active" ? "Stop CCTV" : "Start CCTV"}">
              ${camera.status === "active" ? "Stop" : "Play"}
            </button>
            <button type="button" class="danger-button" data-delete-camera="${camera.id}" title="Hapus CCTV">Hapus</button>
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
  clearStatus();

  try {
    const isEditing = state.editingCameraId !== null;
    await request(isEditing ? `/api/cameras/${state.editingCameraId}` : "/api/cameras", {
      method: isEditing ? "PUT" : "POST",
      body: JSON.stringify({
        name: elements.cameraName.value.trim(),
        stream_url: elements.streamUrl.value.trim(),
        direction: state.direction,
      }),
    });
    resetCameraForm();
    await refresh();
    showStatus(isEditing ? "Data CCTV berhasil diperbarui." : "CCTV baru berhasil ditambahkan ke daftar.");
  } catch (error) {
    showError(error.message || "Gagal menyimpan kamera");
  }
}

function editCamera(cameraId) {
  const camera = state.cameras.find((item) => item.id === cameraId);
  if (!camera) return;

  clearError();
  clearStatus();
  state.editingCameraId = camera.id;
  state.direction = camera.direction;
  elements.cameraName.value = camera.name;
  elements.streamUrl.value = camera.stream_url;
  elements.cameraFormTitle.textContent = "Edit CCTV";
  elements.cameraSubmitButton.textContent = "Simpan Perubahan";
  elements.cancelEditButton.classList.remove("hidden");
  elements.directionButtons.forEach((button) => {
    button.classList.toggle("selected", button.dataset.direction === camera.direction);
  });
  elements.cameraName.focus();
}

function resetCameraForm() {
  state.editingCameraId = null;
  state.direction = "entry";
  elements.cameraFormTitle.textContent = "Tambah CCTV";
  elements.cameraSubmitButton.textContent = "Simpan Kamera";
  elements.cancelEditButton.classList.add("hidden");
  elements.cameraName.value = "Gerbang Depan";
  elements.streamUrl.value = "0";
  elements.directionButtons.forEach((button) => {
    button.classList.toggle("selected", button.dataset.direction === "entry");
  });
}

async function deleteCamera(cameraId) {
  const camera = state.cameras.find((item) => item.id === cameraId);
  if (!camera) return;

  const confirmed = window.confirm(`Hapus CCTV "${camera.name}" dari daftar? Log kendaraan lama tetap tersimpan.`);
  if (!confirmed) return;

  clearError();
  clearStatus();
  try {
    await request(`/api/cameras/${cameraId}`, { method: "DELETE" });
    if (state.editingCameraId === cameraId) {
      resetCameraForm();
    }
    await refresh();
    showStatus("CCTV berhasil dihapus dari daftar.");
  } catch (error) {
    showError(error.message || "Gagal menghapus CCTV");
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

function handleLogin(event) {
  event.preventDefault();
  clearLoginError();

  const username = elements.loginUsername.value.trim();
  const password = elements.loginPassword.value.trim();

  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    showLoginError("Username atau password admin belum sesuai.");
    return;
  }

  sessionStorage.setItem(LOGIN_KEY, "true");
  setLoginState(true);
}

function logout() {
  sessionStorage.removeItem(LOGIN_KEY);
  state.cameras = [];
  state.events = [];
  state.lastSnapshot = null;
  setLoginState(false);
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

  const editButton = event.target.closest("[data-edit-camera]");
  if (editButton) {
    editCamera(Number(editButton.dataset.editCamera));
    return;
  }

  const deleteButton = event.target.closest("[data-delete-camera]");
  if (deleteButton) {
    deleteCamera(Number(deleteButton.dataset.deleteCamera));
    return;
  }

  const toggleButton = event.target.closest("[data-toggle-camera]");
  if (!toggleButton) return;
  toggleCamera(Number(toggleButton.dataset.toggleCamera));
});

elements.cameraForm.addEventListener("submit", saveCamera);
elements.cancelEditButton.addEventListener("click", resetCameraForm);
elements.refreshButton.addEventListener("click", refresh);
elements.loginForm.addEventListener("submit", handleLogin);
elements.logoutButton.addEventListener("click", logout);

function updateClock() {
  if (!elements.currentTime) return;
  elements.currentTime.textContent = new Date().toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

updateClock();
window.setInterval(updateClock, 1000);
setLoginState(isLoggedIn());
