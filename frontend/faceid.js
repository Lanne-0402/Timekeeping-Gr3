(function (global) {
  const API_BASE = global.API_BASE || "http://localhost:5000/api";

  let token = null;
  let uid = null;

  let stream = null;
  let modelsLoaded = false;
  let lastAction = null;
  let isBusy = false;

  // HTML elements
  let dlg, video, statusEl, btnRetry, btnClose;

  // ================================
  // INIT
  // ================================
  async function init({ jwtToken, uid: userId }) {
    token = jwtToken;
    uid = userId;

    dlg = document.getElementById("faceModal");
    video = document.getElementById("faceVideo");
    statusEl = document.getElementById("faceStatus");
    btnRetry = document.getElementById("faceRetryBtn");
    btnClose = document.getElementById("faceCloseBtn");

    if (!dlg || !video || !statusEl) {
      console.error("[FaceID] Missing HTML elements");
      return;
    }

    btnRetry.onclick = () => {
      if (!lastAction) return;
      doFaceAction(lastAction, { retry: true });
    };

    btnClose.onclick = async () => {
      await stopCamera();
      dlg.close();
      resetState();
    };
  }

  // ================================
  // PUBLIC ACTIONS
  // ================================
  function enroll() {
    return doFaceAction("enroll");
  }
  function checkIn() {
    return doFaceAction("checkin");
  }
  function checkOut() {
    return doFaceAction("checkout");
  }

  // ================================
  // CORE FLOW
  // ================================
  async function doFaceAction(action, { retry = false } = {}) {
    if (isBusy && !retry) return;
    isBusy = true;
    lastAction = action;

    dlg.showModal();

    try {
      status("Đang xử lý...");

      // Load models
      if (!modelsLoaded) {
        status("Đang tải mô hình...");
        await loadModels();
        modelsLoaded = true;
      }

      // Start camera
      status("Bật camera...");
      await startCamera();

      // Capture liveness + embedding
      const embedding = await captureLivenessWindow();
      if (!embedding || embedding.length !== 128) {
        throw new Error("Embedding không hợp lệ.");
      }

      // Build API request
      let url = "";
      const body = { embedding, userId: uid };

      if (action === "enroll") {
        url = `${API_BASE}/face/enroll`;
      } else {
        // GPS required
        status("Đang lấy GPS...");
        let gps;
        try {
          gps = await getGPS();
        } catch (err) {
          throw err; // show GPS error
        }
        body.lat = gps.lat;
        body.lng = gps.lng;

        if (action === "checkin") url = `${API_BASE}/face/check-in`;
        if (action === "checkout") url = `${API_BASE}/face/check-out`;
      }

      status("Gửi dữ liệu lên server... (vui lòng đợi)");

      // Timeout 8s để tránh pending vô hạn
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      let res;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token
          },
          body: JSON.stringify(body),
          signal: controller.signal
        });
      } catch (err) {
        clearTimeout(timeout);
        throw new Error("Server không phản hồi. Kiểm tra kết nối.");
      }
      clearTimeout(timeout);

      // Parse JSON safely
      let json;
      try {
        json = await res.json();
      } catch {
        throw new Error("Phản hồi không hợp lệ từ server.");
      }

      if (!res.ok) {
        throw new Error(json.message || `Lỗi server (${res.status})`);
      }

      if (!json.success) {
        throw new Error(json.message || "FaceID thất bại.");
      }

      status("✅ " + json.message);

    } catch (err) {
      console.error("[FaceID Error]", err);
      status("❌ " + err.message);
      isBusy = false;
      return;
    }

    isBusy = false;
  }

  // ================================
  // LOAD MODELS
  // ================================
  async function loadModels() {
    await faceapi.nets.tinyFaceDetector.loadFromUri("./models");
    await faceapi.nets.faceLandmark68Net.loadFromUri("./models");
    await faceapi.nets.faceRecognitionNet.loadFromUri("./models");
  }

  // ================================
  // CAMERA
  // ================================
  async function startCamera() {
    if (stream) stopCamera();

    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } }
    });

    video.srcObject = stream;
    await new Promise((res) => (video.onloadedmetadata = res));
  }

  async function stopCamera() {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    if (video) video.srcObject = null;
  }

  // ================================
  // LIVENESS - CHỚP MẮT
  // ================================
  async function captureLivenessWindow(duration = 2500, interval = 120) {
    const frames = [];
    const start = Date.now();

    status("Giữ mặt trong khung và chớp mắt...");

    while (Date.now() - start < duration) {
      const frame = await detectFrame();
      if (frame) frames.push(frame);
      await wait(interval);
    }

    if (frames.length < 4) {
      throw new Error("Không phát hiện mặt. Lại gần camera.");
    }

    const mid = frames[Math.floor(frames.length / 2)];
    const box = mid.box;

    // mặt quá nhỏ
    if (
      box.width < video.videoWidth * 0.15 ||
      box.height < video.videoHeight * 0.15
    ) {
      throw new Error("Mặt quá xa camera.");
    }

    // EAR liveness
    const ears = frames.map((f) => f.ear);
    const earDelta = Math.max(...ears) - Math.min(...ears);
    if (earDelta < 0.04) {
      throw new Error("Không thấy chớp mắt.");
    }

    // tạo embedding trung bình
    const len = mid.descriptor.length;
    const avg = [];
    for (let i = 0; i < len; i++) {
      avg.push(frames.reduce((s, f) => s + f.descriptor[i], 0) / frames.length);
    }

    status("Liveness OK.");
    return avg;
  }

  async function detectFrame() {
    const opts = new faceapi.TinyFaceDetectorOptions({
      inputSize: 384,
      scoreThreshold: 0.5
    });

    const det = await faceapi
      .detectSingleFace(video, opts)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!det) return null;

    return {
      descriptor: Array.from(det.descriptor),
      ear: computeEAR(det.landmarks),
      box: det.detection.box
    };
  }

  function computeEAR(landmarks) {
    const L = landmarks.getLeftEye();
    const R = landmarks.getRightEye();
    const dist = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

    const earOne = (eye) => {
      const A = dist(eye[1], eye[5]);
      const B = dist(eye[2], eye[4]);
      const C = dist(eye[0], eye[3]);
      return (A + B) / (2 * C);
    };

    return (earOne(L) + earOne(R)) / 2;
  }

  // ================================
  // GPS FIXED
  // ================================
  async function getGPS() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        return reject(new Error("Thiết bị không hỗ trợ GPS."));
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          if (!latitude || !longitude) {
            return reject(new Error("GPS không hợp lệ."));
          }
          resolve({ lat: latitude, lng: longitude });
        },
        () => reject(new Error("Không lấy được GPS. Hãy bật định vị.")),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  // ================================
  // HELPERS
  // ================================
  function wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function status(msg) {
    if (statusEl) statusEl.textContent = msg;
  }

  function resetState() {
    isBusy = false;
    lastAction = null;
    status("");
  }

  // ================================
  // EXPORT
  // ================================
  global.FaceID = { init, enroll, checkIn, checkOut };
})(window);
