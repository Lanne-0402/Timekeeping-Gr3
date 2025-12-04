(function (global) {
  const API_BASE = global.API_BASE || "http://localhost:5000/api";

  let token = null;
  let uid = null;

  let stream = null;
  let modelsLoaded = false;
  let lastAction = null;
  let isBusy = false;

  // HTML
  let dlg, video, statusEl, btnRetry, btnClose;

  // =============================
  // INIT
  // =============================
  async function init({ jwtToken, uid: userId }) {
    token = jwtToken;
    uid = userId;

    dlg = document.getElementById("faceModal");
    video = document.getElementById("faceVideo");
    statusEl = document.getElementById("faceStatus");
    btnRetry = document.getElementById("faceRetryBtn");
    btnClose = document.getElementById("faceCloseBtn");

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

  // =============================
  // PUBLIC METHODS
  // =============================
  function enroll() {
    return doFaceAction("enroll");
  }
  function checkIn() {
    return doFaceAction("checkin");
  }
  function checkOut() {
    return doFaceAction("checkout");
  }

  // =============================
  // CORE FLOW
  // =============================
  async function doFaceAction(action, { retry = false } = {}) {
    if (isBusy && !retry) return;
    isBusy = true;

    lastAction = action;
    dlg.showModal();

    try {
      status("Đang xử lý...");

      if (!modelsLoaded) {
        status("Đang tải mô hình...");
        await loadModels();
        modelsLoaded = true;
      }

      status("Bật camera...");
      await startCamera();

      status("Đang phân tích gương mặt...");
      const embedding = await captureBestFrame();

      console.log("EMBED SENT:", embedding);

      if (!embedding || embedding.some(isNaN)) {
        throw new Error("Không tạo được embedding hợp lệ.");
      }

      let url = "";
      const body = { embedding, userId: uid };

      if (action === "enroll") {
        url = `${API_BASE}/face/enroll`;
      } else {
        const gps = await getGPS();
        body.lat = gps.lat;
        body.lng = gps.lng;

        if (action === "checkin") url = `${API_BASE}/face/check-in`;
        if (action === "checkout") url = `${API_BASE}/face/check-out`;
      }

      status("Gửi dữ liệu lên server...");
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.message);

      status("✅ " + json.message);
    } catch (err) {
      console.error("[FaceID Error]", err);
      status("❌ " + err.message);
      isBusy = false;
      return;
    }

    isBusy = false;
  }

  // =============================
  // LOAD MODELS (CRITICAL)
  // =============================
  async function loadModels() {
    // Bắt buộc bật WebGL để SSD chạy được
    await faceapi.tf.setBackend("webgl");
    await faceapi.tf.ready();

    console.log("BACKEND:", faceapi.tf.getBackend());

    await faceapi.nets.ssdMobilenetv1.loadFromUri("./models");
    await faceapi.nets.faceLandmark68Net.loadFromUri("./models");
    await faceapi.nets.faceRecognitionNet.loadFromUri("./models");
  }

  // =============================
  // CAMERA
  // =============================
  async function startCamera() {
    video.style.transform = "scaleX(-1)";

    if (stream) stopCamera();

    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720 },
    });

    video.srcObject = stream;
    await new Promise((res) => (video.onloadedmetadata = res));
  }

  async function stopCamera() {
    if (stream) stream.getTracks().forEach((t) => t.stop());
  }

  // =============================
  // CAPTURE + EMBEDDING
  // =============================
  async function captureBestFrame(timeout = 3500, interval = 150) {
  const start = Date.now();
  let best = null;

  status("Đưa mặt gần camera, giữ yên 2–3 giây...");

  while (Date.now() - start < timeout) {
    const frame = await detectFrame();

    if (frame && frame.descriptor) {
      // Làm sạch descriptor: NaN -> 0
      const cleaned = frame.descriptor.map(v =>
        Number.isFinite(v) ? v : 0
      );

      if (!best ||
          frame.box.width * frame.box.height >
            best.box.width * best.box.height) {
        best = {
          descriptor: cleaned,
          box: frame.box,
        };
      }
    }

    await wait(interval);
  }

  if (!best) {
    throw new Error("Không thu được frame khuôn mặt nào đủ rõ.");
  }

  console.log(
    "BEST DESCRIPTOR (10 numbers): ",
    best.descriptor.slice(0, 10)
  );

  return best.descriptor;
}
  // =============================
  // DETECT FRAME (SSD)
  // =============================
  async function detectFrame() {
  const det = await faceapi
    .detectSingleFace(video)
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!det) return null;

  const box = det.detection.box;

  // relax condition: cho mặt nhỏ hơn nữa
  if (
    box.width < video.videoWidth * 0.05 ||
    box.height < video.videoHeight * 0.05
  ) {
    console.warn("Face too small -> skip");
    return null;
  }

  const descriptor = Array.from(det.descriptor);

  console.log(
    "FRAME BOX:", box.width, box.height,
    "DESC:", descriptor.slice(0, 4)
  );

  return { descriptor, box };
}



  // =============================
  // EAR (blink detection)
  // =============================
  function computeEAR(landmarks) {
    const L = landmarks.getLeftEye();
    const R = landmarks.getRightEye();

    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

    const earEye = (eye) => {
      const A = dist(eye[1], eye[5]);
      const B = dist(eye[2], eye[4]);
      const C = dist(eye[0], eye[3]);
      return (A + B) / (2 * C);
    };

    return (earEye(L) + earEye(R)) / 2;
  }

  // =============================
  // GPS
  // =============================
  function getGPS() {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }),
        () => reject(new Error("Không lấy được GPS.")),
        { enableHighAccuracy: true }
      );
    });
  }

  // =============================
  // HELPERS
  // =============================
  function wait(ms) {
    return new Promise((res) => setTimeout(res, ms));
  }

  function status(msg) {
    if (statusEl) statusEl.textContent = msg;
  }

  function resetState() {
    isBusy = false;
    lastAction = null;
    status("");
  }

  // EXPORT
  global.FaceID = { init, enroll, checkIn, checkOut };
})(window);
