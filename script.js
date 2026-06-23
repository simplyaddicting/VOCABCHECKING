(function () {
  "use strict";

  // ─── DEFAULT SAMPLE DATA ───────────────────────────────────────────────────
  var DEFAULT_WORDS = [
    { word: "ephemeral",  meaning: "lasting for a very short time",  synonyms: ["fleeting", "transient"],    antonyms: ["permanent", "enduring"] },
    { word: "candid",     meaning: "truthful and straightforward",    synonyms: ["honest", "frank"],          antonyms: ["deceitful"] },
    { word: "mirth",      meaning: "great amusement or laughter",     synonyms: [],                           antonyms: [] },
    { word: "stoic",      meaning: "",                                synonyms: ["unaffected", "unemotional"],antonyms: ["emotional", "reactive"] },
    { word: "reluctant",  meaning: "unwilling and hesitant",          synonyms: ["hesitant", "disinclined"],  antonyms: ["eager", "willing"] }
  ];

  var STOPWORDS = new Set(["a","an","the","of","to","in","on","is","are","was","were","be","being","been",
    "that","this","it","as","by","for","with","and","or","at","from","which","who","whom","its","their",
    "his","her","they","them","he","she","you","your","i","we","our","not","no","so","than","then","such",
    "very","more","most","but","if","can","will","would","could","should","do","does","did","has","have",
    "had","also","one","someone","something"]);

  // ─── STATE ─────────────────────────────────────────────────────────────────
  var state = {
    words: DEFAULT_WORDS,
    timeLimitSeconds: 1800,
    studentName: "",
    remainingSeconds: 1800,
    timerInterval: null
  };

  // ─── HELPERS ───────────────────────────────────────────────────────────────
  function $(id) { return document.getElementById(id); }

  function showScreen(id) {
    document.querySelectorAll(".screen").forEach(function (s) { s.classList.remove("active"); });
    $(id).classList.add("active");
  }

  function formatTime(s) {
    var m = Math.floor(s / 60);
    return String(m).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
  }

  function norm(s) { return (s || "").toLowerCase().trim().replace(/[.,!?;:…]+$/, ""); }

  function splitTokens(str) {
    return (str || "").split(/[,;/]+/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function matchAny(userTokens, accepted) {
    var an = accepted.map(norm);
    return userTokens.some(function (t) { return an.indexOf(norm(t)) !== -1; });
  }

  function significantWords(str) {
    return (str || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
      .filter(function (w) { return w && !STOPWORDS.has(w); });
  }

  function gradeMeaning(userAnswer, correct) {
    var uSet = new Set(significantWords(userAnswer));
    var cWords = significantWords(correct);
    var cSet = new Set(cWords);
    if (cSet.size === 0) return uSet.size > 0;
    var matched = 0;
    cSet.forEach(function (w) { if (uSet.has(w)) matched++; });
    return (matched / cSet.size) >= 0.4;
  }

  // ─── WORD STRUCTURE HELPERS ────────────────────────────────────────────────
  function hasMeaning(item)   { return !!(item.meaning && item.meaning.trim()); }
  function hasSynonyms(item)  { return item.synonyms && item.synonyms.length > 0; }
  function hasAntonyms(item)  { return item.antonyms && item.antonyms.length > 0; }

  function getItemConfig(item) {
    if (hasMeaning(item)) {
      return {
        clueType: "meaning",
        testWord: true,
        testMeaning: false,
        testSyn: hasSynonyms(item),
        testAnt: hasAntonyms(item)
      };
    }
    if (hasSynonyms(item) && hasAntonyms(item)) {
      return {
        clueType: "syn",
        testWord: true,
        testMeaning: false,
        testSyn: false,
        testAnt: true
      };
    }
    if (hasSynonyms(item)) {
      return { clueType: "syn", testWord: true, testMeaning: false, testSyn: false, testAnt: false };
    }
    return { clueType: "ant", testWord: true, testMeaning: false, testSyn: false, testAnt: false };
  }

  // ─── PARSING ───────────────────────────────────────────────────────────────
  function parseCsvLine(line) {
    var result = [];
    var cur = "";
    var inQuotes = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; }
          else { inQuotes = false; }
        } else {
          cur += ch;
        }
      } else {
        if (ch === '"') { inQuotes = true; }
        else if (ch === ",") { result.push(cur.trim()); cur = ""; }
        else { cur += ch; }
      }
    }
    result.push(cur.trim());
    return result;
  }

  function parseWordList(text) {
    var lines = text.split(/\r?\n/);
    var words = [];
    var skipped = 0;

    lines.forEach(function (line) {
      var trimmed = line.trim();
      if (!trimmed || trimmed.charAt(0) === "#") return;

      var parts;
      if (trimmed.indexOf("|") !== -1) {
        parts = trimmed.split("|").map(function (p) { return p.trim(); });
      } else {
        parts = parseCsvLine(trimmed);
      }

      if (parts[0] && parts[0].toLowerCase() === "word") return;

      if (parts.length < 2 || !parts[0]) { skipped++; return; }

      var word     = parts[0] || "";
      var meaning  = parts[1] || "";
      var synonyms = splitTokens(parts[2] || "");
      var antonyms = splitTokens(parts[3] || "");

      if (!word) { skipped++; return; }
      if (!meaning && synonyms.length === 0 && antonyms.length === 0) { skipped++; return; }

      words.push({ word: word, meaning: meaning, synonyms: synonyms, antonyms: antonyms });
    });

    return { words: words, skipped: skipped };
  }

  // ─── QUIZ BUILD ────────────────────────────────────────────────────────────
  function buildQuizTable() {
    var tbody = $("quiz-tbody");
    tbody.innerHTML = "";

    state.words.forEach(function (item, idx) {
      var cfg = getItemConfig(item);
      var tr = document.createElement("tr");
      tr.dataset.index = idx;

      var tdNum = document.createElement("td");
      tdNum.style.cssText = "width:36px;color:var(--ink-faint);font-family:'Space Mono',monospace;font-size:12px;text-align:right;padding-right:8px;";
      tdNum.textContent = String(idx + 1).padStart(2, "0");
      tdNum.setAttribute("data-label", "#");

      var tdClue = document.createElement("td");
      tdClue.setAttribute("data-label", "Clue");
      tdClue.className = "clue-cell";

      var clueTag = document.createElement("div");
      clueTag.className = "clue-tag";

      if (cfg.clueType === "meaning") {
        clueTag.textContent = "Definition";
        var clueText = document.createElement("div");
        clueText.className = "clue-text";
        clueText.textContent = item.meaning;
        tdClue.appendChild(clueTag);
        tdClue.appendChild(clueText);
      } else if (cfg.clueType === "syn") {
        clueTag.textContent = "Synonym(s)";
        var clueText = document.createElement("div");
        clueText.className = "clue-text";
        clueText.textContent = item.synonyms.join(", ");
        tdClue.appendChild(clueTag);
        tdClue.appendChild(clueText);
      } else {
        clueTag.textContent = "Antonym(s)";
        var clueText = document.createElement("div");
        clueText.className = "clue-text";
        clueText.textContent = item.antonyms.join(", ");
        tdClue.appendChild(clueTag);
        tdClue.appendChild(clueText);
      }

      var tdWord = document.createElement("td");
      tdWord.setAttribute("data-label", "Word");
      var wordSpacer = document.createElement("div");
      wordSpacer.className = "sub-label";
      wordSpacer.style.visibility = "hidden";
      wordSpacer.textContent = "\u00A0";
      tdWord.appendChild(wordSpacer);
      var wordInput = document.createElement("input");
      wordInput.type = "text";
      wordInput.className = "field-input word-input";
      wordInput.placeholder = "Enter the word…";
      tdWord.appendChild(wordInput);

      var tdSynAnt = document.createElement("td");
      tdSynAnt.className = "syn-ant-cell";
      tdSynAnt.setAttribute("data-label", "Synonyms & Antonyms");

      var hasAnything = false;

      if (cfg.testSyn) {
        hasAnything = true;
        var g = document.createElement("div"); g.className = "field-group";
        var lbl = document.createElement("div"); lbl.className = "sub-label"; lbl.textContent = "Synonym";
        var inp = document.createElement("input"); inp.type = "text";
        inp.className = "field-input syn-input"; inp.placeholder = "e.g. fleeting";
        g.appendChild(lbl); g.appendChild(inp);
        tdSynAnt.appendChild(g);
      }

      if (cfg.testAnt) {
        hasAnything = true;
        var g2 = document.createElement("div"); g2.className = "field-group";
        var lbl2 = document.createElement("div"); lbl2.className = "sub-label"; lbl2.textContent = "Antonym";
        var inp2 = document.createElement("input"); inp2.type = "text";
        inp2.className = "field-input ant-input"; inp2.placeholder = "e.g. permanent";
        g2.appendChild(lbl2); g2.appendChild(inp2);
        tdSynAnt.appendChild(g2);
      }

      if (!hasAnything) {
        var na = document.createElement("div"); na.className = "field-na";
        na.textContent = "—";
        tdSynAnt.appendChild(na);
      }

      tr.appendChild(tdNum);
      tr.appendChild(tdClue);
      tr.appendChild(tdWord);
      tr.appendChild(tdSynAnt);
      tbody.appendChild(tr);
    });
  }

  // ─── TIMER ─────────────────────────────────────────────────────────────────
  function startTimer() {
    clearInterval(state.timerInterval);
    state.remainingSeconds = state.timeLimitSeconds;
    updateTimerDisplay();
    state.timerInterval = setInterval(function () {
      state.remainingSeconds--;
      updateTimerDisplay();
      if (state.remainingSeconds <= 0) { clearInterval(state.timerInterval); submitQuiz(); }
    }, 1000);
  }

  function updateTimerDisplay() {
    var el = $("timer-display"), prog = $("timer-progress");
    var secs = Math.max(0, state.remainingSeconds);
    el.textContent = formatTime(secs);
    var ratio = secs / state.timeLimitSeconds;
    prog.style.width = (ratio * 100) + "%";
    el.classList.remove("low-time", "critical-time");
    prog.classList.remove("low", "critical");
    if (secs <= 30) { el.classList.add("critical-time"); prog.classList.add("critical"); }
    else if (secs <= 60) { el.classList.add("low-time"); prog.classList.add("low"); }
  }

  // ─── GRADING ───────────────────────────────────────────────────────────────
  function collectAnswers() {
    return Array.from(document.querySelectorAll("#quiz-tbody tr")).map(function (row) {
      var wEl  = row.querySelector(".word-input");
      var sEl  = row.querySelector(".syn-input");
      var aEl  = row.querySelector(".ant-input");
      return {
        word:    wEl  ? wEl.value.trim()  : "",
        synonym: sEl  ? sEl.value.trim()  : "",
        antonym: aEl  ? aEl.value.trim()  : ""
      };
    });
  }

  function gradeAll(answers) {
    var results = [], correct = 0, total = 0;

    state.words.forEach(function (item, idx) {
      var cfg = getItemConfig(item);
      var ans = answers[idx] || { word: "", synonym: "", antonym: "" };

      var wordOk = norm(ans.word) === norm(item.word);
      correct += wordOk ? 1 : 0;
      total++;

      var synOk = null, antOk = null;

      if (cfg.testSyn) {
        synOk = ans.synonym ? matchAny(splitTokens(ans.synonym), item.synonyms) : false;
        correct += synOk ? 1 : 0;
        total++;
      }
      if (cfg.testAnt) {
        antOk = ans.antonym ? matchAny(splitTokens(ans.antonym), item.antonyms) : false;
        correct += antOk ? 1 : 0;
        total++;
      }

      results.push({ item: item, cfg: cfg, ans: ans, wordOk: wordOk, synOk: synOk, antOk: antOk });
    });

    return { results: results, correctCount: correct, total: total };
  }

  // ─── RENDER RESULTS ────────────────────────────────────────────────────────
  function renderResults(graded) {
    var tbody = $("results-tbody");
    tbody.innerHTML = "";

    graded.results.forEach(function (r, idx) {
      var tr = document.createElement("tr");

      var tdNum = document.createElement("td");
      tdNum.style.cssText = "width:36px;color:var(--ink-faint);font-family:'Space Mono',monospace;font-size:12px;text-align:right;padding-right:8px;";
      tdNum.textContent = String(idx + 1).padStart(2, "0");
      tdNum.setAttribute("data-label", "#");

      var tdClue = document.createElement("td");
      tdClue.setAttribute("data-label", "Clue");
      tdClue.className = "clue-cell";
      var clueTag2 = document.createElement("div"); clueTag2.className = "clue-tag";
      var clueText2 = document.createElement("div"); clueText2.className = "clue-text";
      if (r.cfg.clueType === "meaning") {
        clueTag2.textContent = "Definition"; clueText2.textContent = r.item.meaning;
      } else if (r.cfg.clueType === "syn") {
        clueTag2.textContent = "Synonym(s)"; clueText2.textContent = r.item.synonyms.join(", ");
      } else {
        clueTag2.textContent = "Antonym(s)"; clueText2.textContent = r.item.antonyms.join(", ");
      }
      tdClue.appendChild(clueTag2); tdClue.appendChild(clueText2);

      var tdWord = document.createElement("td");
      tdWord.setAttribute("data-label", "Word");
      tdWord.className = r.wordOk ? "cell-correct" : "cell-incorrect";
      tdWord.innerHTML = '<div class="sub-label" style="visibility:hidden;padding-top:8px;">&nbsp;</div>' +
        '<div class="field-display word-answer">' + (r.ans.word || "—") + "</div>" +
        (!r.wordOk ? '<div class="correct-answer-hint">' + r.item.word + "</div>" : "");

      var tdSynAnt = document.createElement("td");
      tdSynAnt.setAttribute("data-label", "Synonyms & Antonyms");
      var blocks = "";

      if (r.cfg.testSyn) {
        var sc = r.synOk ? "cell-correct" : "cell-incorrect";
        blocks += '<div class="syn-ant-block ' + sc + '">' +
          '<div class="sub-label">Synonym</div>' +
          '<div class="field-display">' + (r.ans.synonym || "—") + "</div>" +
          (!r.synOk ? '<div class="correct-answer-hint">' + r.item.synonyms.join(", ") + "</div>" : "") +
          "</div>";
      }
      if (r.cfg.testAnt) {
        var ac = r.antOk ? "cell-correct" : "cell-incorrect";
        blocks += '<div class="syn-ant-block ' + ac + '">' +
          '<div class="sub-label">Antonym</div>' +
          '<div class="field-display">' + (r.ans.antonym || "—") + "</div>" +
          (!r.antOk ? '<div class="correct-answer-hint">' + r.item.antonyms.join(", ") + "</div>" : "") +
          "</div>";
      }
      if (!r.cfg.testSyn && !r.cfg.testAnt) {
        blocks = '<div class="field-na">—</div>';
      }
      tdSynAnt.innerHTML = blocks;

      tr.appendChild(tdNum);
      tr.appendChild(tdClue);
      tr.appendChild(tdWord);
      tr.appendChild(tdSynAnt);
      tbody.appendChild(tr);
    });

    var pct = graded.total > 0 ? Math.round((graded.correctCount / graded.total) * 100) : 0;
    $("score-percent").textContent = pct + "%";
    $("score-fraction").textContent = graded.correctCount + " / " + graded.total;
    $("results-student-name").textContent = state.studentName;

    var badge = $("results-badge");
    if (pct >= 80) { badge.textContent = "🎉 Excellent!"; badge.style.cssText = "background:rgba(22,163,74,.2);color:#86EFAC"; }
    else if (pct >= 60) { badge.textContent = "👍 Good job!"; badge.style.cssText = "background:rgba(37,99,235,.2);color:#93C5FD"; }
    else { badge.textContent = "📚 Keep studying"; badge.style.cssText = "background:rgba(255,255,255,.1);color:rgba(255,255,255,.6)"; }
  }

  function submitQuiz() {
    clearInterval(state.timerInterval);
    var graded = gradeAll(collectAnswers());
    renderResults(graded);
    showScreen("screen-results");
  }

  // ─── GOOGLE SHEETS AUTO-LOAD ────────────────────────────────────────────────
  var STORAGE_KEY_URL  = "vocab_sheets_url";
  var STORAGE_KEY_TIME = "vocab_time_limit";
  
  // Các key dùng cho hệ thống Cache từ vựng chống lỗi F5
  var STORAGE_KEY_CACHE_WORDS = "vocab_cache_words";
  var STORAGE_KEY_CACHE_SRC   = "vocab_cache_source_url";

  function getSavedUrl()  { try { return localStorage.getItem(STORAGE_KEY_URL) || ""; }  catch(e){ return ""; } }
  function getSavedTime() { try { return parseInt(localStorage.getItem(STORAGE_KEY_TIME) || "5", 10); } catch(e){ return 5; } }
  function saveUrl(url)   { try { localStorage.setItem(STORAGE_KEY_URL, url); }  catch(e){} }
  function saveTime(t)    { try { localStorage.setItem(STORAGE_KEY_TIME, String(t)); } catch(e){} }
  function clearUrl()     { 
    try { 
      localStorage.removeItem(STORAGE_KEY_URL); 
      localStorage.removeItem(STORAGE_KEY_CACHE_WORDS);
      localStorage.removeItem(STORAGE_KEY_CACHE_SRC);
    } catch(e){} 
  }

  function getUrlParams() {
    var params = new URLSearchParams(window.location.search);
    return {
      sheet: params.get("sheet") || "",
      time: parseInt(params.get("time"), 10) || null
    };
  }

  // ─── ĐÃ SỬA: Bỏ CORS proxy bên thứ ba (corsproxy.io / allorigins.win) ──────
  // Lý do: các proxy miễn phí đó tự cache response ở server của HỌ trong vài
  // phút. Cache-buster (_t=timestamp) chỉ chặn được cache trình duyệt, không
  // chặn được cache phía proxy — nên mỗi lần F5, proxy có thể trả bản CSV cũ
  // hoặc mới tùy may rủi, gây ra hiện tượng "nhảy" giữa sheet cũ và mới.
  //
  // Endpoint gviz/tq của chính Google trả CORS header hợp lệ, nên trình duyệt
  // gọi thẳng được — không cần proxy, không còn lớp cache trung gian nào nữa.
  // Endpoint này dùng Sheet ID + gid (không cần "Publish to web" như trước).

  function extractSheetId(url) {
    var m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return m ? m[1] : null;
  }

  function extractGid(url) {
    var m = url.match(/[?&#]gid=(\d+)/);
    return m ? m[1] : "0";
  }

  // Chuyển bất kỳ link Google Sheets nào (link edit, link share, hoặc link
  // /pub?output=csv cũ) thành link CSV gviz/tq chuẩn, hỗ trợ CORS.
  function toGvizCsvUrl(url) {
    var id = extractSheetId(url);
    if (!id) return null;
    var gid = extractGid(url);
    return "https://docs.google.com/spreadsheets/d/" + id +
           "/gviz/tq?tqx=out:csv&gid=" + gid;
  }

  function tryFetchText(url) {
    var separator = url.indexOf('?') !== -1 ? '&' : '?';
    var noCacheUrl = url + separator + "_t=" + new Date().getTime();

    return fetch(noCacheUrl, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.text();
    });
  }

  function fetchSheetCsv(url) {
    var gvizUrl = toGvizCsvUrl(url);
    if (!gvizUrl) {
      return Promise.reject(new Error("Link Google Sheets không hợp lệ — không tìm thấy Sheet ID. Hãy dán link dạng .../spreadsheets/d/SHEET_ID/edit..."));
    }
    return tryFetchText(gvizUrl).then(function (text) {
      if (/^\s*<(!doctype|html)/i.test(text)) {
        throw new Error("Sheet chưa public — vào File → Share → General access → \"Anyone with the link\" rồi thử lại.");
      }
      return text;
    });
  }

  function loadWordsFromUrl(url, onSuccess, onError) {
    fetchSheetCsv(url)
      .then(function (text) {
        var parsed = parseWordList(text);
        if (parsed.words.length === 0) throw new Error("No valid words found. Check the sheet's format and that it's shared publicly.");
        state.words = parsed.words;
        onSuccess(parsed);
      })
      .catch(function (err) { onError(err.message); });
  }

  // ─── ĐÃ SỬA: Hàm kiểm tra Cache Local khi vừa khởi chạy ────────────────────
// ─── HÀM CẬP NHẬT: TỰ ĐỘNG ĐỒNG BỘ KHI SHEET THAY ĐỔI + CHỐNG LỖI F5 ───
  function autoLoadOnStart() {
    var urlParams = getUrlParams();
    var savedUrl = getSavedUrl();
    var savedTime = getSavedTime();

    var sheetUrl = urlParams.sheet || savedUrl;
    var minutes = urlParams.time || savedTime;

    state.timeLimitSeconds = minutes * 60;
    $("time-limit-input").value = minutes;

    if (!sheetUrl) return;

    // Hiển thị trạng thái loading để kết nối mạng kiểm tra dữ liệu mới trước
    $("splash-form").style.display = "none";
    $("splash-loading").style.display = "";

    // Tiến hành tải dữ liệu từ Google Sheets (đã có timestamp chống đứng cache proxy)
    loadWordsFromUrl(sheetUrl,
      function (parsed) {
        $("splash-loading").style.display = "none";
        $("splash-form").style.display = "";
        var badge = $("words-loaded-badge");
        
        // Cập nhật số từ mới nhất vừa tải trực tiếp từ internet về
        $("words-loaded-count").textContent = "✓ " + parsed.words.length + " words loaded dynamically";
        badge.style.display = "";
        
        // Ghi đè dữ liệu mới nhất (32 từ) này vào bộ nhớ máy, phòng trường hợp học sinh F5
        try {
          localStorage.setItem(STORAGE_KEY_CACHE_WORDS, JSON.stringify(parsed.words));
          localStorage.setItem(STORAGE_KEY_CACHE_SRC, sheetUrl);
        } catch(e) {}
      },
      function (errMsg) {
        // NẾU MẤT MẠNG HOẶC PROXY LỖI (Học sinh F5 liên tục bị chặn): Lập tức cứu cánh bằng Cache cũ!
        try {
          var localCache = localStorage.getItem(STORAGE_KEY_CACHE_WORDS);
          var localSrc = localStorage.getItem(STORAGE_KEY_CACHE_SRC);
          
          if (localCache && localSrc === sheetUrl) {
            var cachedWords = JSON.parse(localCache);
            state.words = cachedWords;
            
            $("splash-loading").style.display = "none";
            $("splash-form").style.display = "";
            var badge = $("words-loaded-badge");
            $("words-loaded-count").textContent = "✓ " + cachedWords.length + " words loaded from backup (offline)";
            badge.style.display = "";
            return; // Cứu vãn thành công, không hiện màn hình lỗi nữa
          }
        } catch(e) { console.error("Backup cache error:", e); }

        // Nếu cả mạng lỗi lẫn không có cache backup thì mới hiện bảng thông báo lỗi
        $("splash-loading").style.display = "none";
        $("splash-error").style.display = "";
        $("splash-error-msg").textContent = errMsg;
        setTimeout(function () {
          $("splash-error").style.display = "none";
          $("splash-form").style.display = "";
        }, 4000);
      }
    );
  }

  // ─── EVENTS: SPLASH ────────────────────────────────────────────────────────
  $("name-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var name = $("name-input").value.trim();
    if (!name) return;
    state.studentName = name;
    $("quiz-student-name").textContent = name;
    buildQuizTable();
    startTimer();
    showScreen("screen-quiz");
  });

  $("submit-quiz").addEventListener("click", submitQuiz);

  $("next-student").addEventListener("click", function () {
    $("name-input").value = "";
    showScreen("screen-splash");
  });

  // ─── EVENTS: MODAL ─────────────────────────────────────────────────────────
  function openModal() {
    var urlParams = getUrlParams();
    var current = urlParams.sheet || getSavedUrl();
    $("sheets-url-input").value = current;
    updateSavedUrlDisplay(getSavedUrl());

    if (current) {
      var minutes = urlParams.time || getSavedTime();
      showShareLink(current, minutes);
    } else {
      $("share-link-box").style.display = "none";
    }

    $("import-feedback").textContent = "";
    $("import-feedback").className = "import-feedback";
    $("modal-import").classList.add("active");
  }
  function closeModal() { $("modal-import").classList.remove("active"); }

  function updateSavedUrlDisplay(url) {
    var row = $("saved-url-row");
    if (url) {
      row.style.display = "";
      $("saved-url-display").textContent = url.length > 60 ? url.slice(0, 60) + "…" : url;
    } else {
      row.style.display = "none";
    }
  }

  $("open-import").addEventListener("click", openModal);
  $("cancel-import").addEventListener("click", closeModal);
  $("cancel-import-btn").addEventListener("click", closeModal);
  $("modal-import").addEventListener("click", function (e) { if (e.target.id === "modal-import") closeModal(); });

  document.querySelectorAll(".import-tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      document.querySelectorAll(".import-tab").forEach(function (t) { t.classList.remove("active"); });
      document.querySelectorAll(".tab-panel").forEach(function (p) { p.classList.remove("active"); });
      tab.classList.add("active");
      $(tab.dataset.tab).classList.add("active");
    });
  });

  function buildShareLink(sheetUrl, minutes) {
    var base = window.location.origin + window.location.pathname;
    var params = new URLSearchParams();
    params.set("sheet", sheetUrl);
    if (minutes) params.set("time", minutes);
    return base + "?" + params.toString();
  }

  function showShareLink(sheetUrl, minutes) {
    var link = buildShareLink(sheetUrl, minutes);
    $("share-link-output").value = link;
    $("share-link-box").style.display = "";
  }

  $("fetch-sheets-btn").addEventListener("click", function () {
    var url = $("sheets-url-input").value.trim();
    if (!url) return;
    var statusEl = $("sheets-fetch-status");
    var btn = $("fetch-sheets-btn");
    statusEl.className = "fetch-status loading";
    statusEl.innerHTML = '<div class="spinner"></div> Testing…';
    btn.disabled = true;
    $("troubleshoot-box").style.display = "none";

    loadWordsFromUrl(url,
      function (parsed) {
        statusEl.className = "fetch-status success";
        statusEl.textContent = "✓ " + parsed.words.length + " words found" + (parsed.skipped ? " (" + parsed.skipped + " skipped)" : "");
        btn.disabled = false;
        var minutes = parseInt($("time-limit-input").value, 10) || 5;
        showShareLink(url, minutes);
        
        // Cập nhật lại cache mới khi test thành công
        try {
          localStorage.setItem(STORAGE_KEY_CACHE_WORDS, JSON.stringify(parsed.words));
          localStorage.setItem(STORAGE_KEY_CACHE_SRC, url);
        } catch(e) {}
      },
      function (err) {
        statusEl.className = "fetch-status error";
        statusEl.textContent = "✕ " + err;
        btn.disabled = false;
        $("share-link-box").style.display = "none";
        $("troubleshoot-box").style.display = "";
      }
    );
  });

  $("copy-share-link").addEventListener("click", function () {
    var input = $("share-link-output");
    input.select();
    var btn = $("copy-share-link");
    navigator.clipboard.writeText(input.value).then(function () {
      var original = btn.textContent;
      btn.textContent = "✓ Copied!";
      setTimeout(function () { btn.textContent = original; }, 1500);
    }).catch(function () {
      document.execCommand("copy");
    });
  });

  $("clear-saved-url").addEventListener("click", function () {
    clearUrl();
    $("sheets-url-input").value = "";
    updateSavedUrlDisplay("");
    state.words = DEFAULT_WORDS;
    $("words-loaded-badge").style.display = "none";
  });

  $("import-file").addEventListener("change", function (e) {
    var file = e.target.files[0];
    if (!file) return;
    $("file-name-display").textContent = "📄 " + file.name;
    var reader = new FileReader();
    reader.onload = function (evt) { $("import-textarea").value = evt.target.result; };
    reader.readAsText(file);
  });

  var area = $("file-upload-area");
  area.addEventListener("dragover",  function (e) { e.preventDefault(); area.style.borderColor = "var(--blue)"; area.style.background = "var(--blue-light)"; });
  area.addEventListener("dragleave", function ()  { area.style.borderColor = ""; area.style.background = ""; });
  area.addEventListener("drop", function (e) {
    e.preventDefault(); area.style.borderColor = ""; area.style.background = "";
    var file = e.dataTransfer.files[0];
    if (!file) return;
    $("file-name-display").textContent = "📄 " + file.name;
    var reader = new FileReader();
    reader.onload = function (evt) { $("import-textarea").value = evt.target.result; };
    reader.readAsText(file);
  });

  // ─── CONFIRM IMPORT ────────────────────────────────────────────────────────
  $("confirm-import").addEventListener("click", function () {
    var fb = $("import-feedback");
    var minutes = parseInt($("time-limit-input").value, 10) || 5;
    var activeTab = document.querySelector(".import-tab.active").dataset.tab;

    if (activeTab === "tab-sheets") {
      var url = $("sheets-url-input").value.trim();
      if (!url) {
        fb.className = "import-feedback error"; fb.textContent = "Please enter a Google Sheets CSV URL."; return;
      }
      fb.className = "import-feedback loading"; fb.style.display = "flex";
      fb.innerHTML = '<div class="spinner"></div> Saving &amp; loading…';
      $("troubleshoot-box").style.display = "none";

      loadWordsFromUrl(url,
        function (parsed) {
          saveUrl(url);
          saveTime(minutes);
          state.timeLimitSeconds = minutes * 60;
          updateSavedUrlDisplay(url);
          showShareLink(url, minutes);
          
          // Đồng bộ cache local luôn khi giáo viên bấm Confirm
          try {
            localStorage.setItem(STORAGE_KEY_CACHE_WORDS, JSON.stringify(parsed.words));
            localStorage.setItem(STORAGE_KEY_CACHE_SRC, url);
          } catch(e) {}

          var badge = $("words-loaded-badge");
          $("words-loaded-count").textContent = "✓ " + parsed.words.length + " words loaded for today";
          badge.style.display = "";
          fb.className = "import-feedback success";
          fb.style.display = "";
          fb.textContent = parsed.words.length + " word(s) loaded · " + minutes + " min limit. Copy the share link below to send to students.";
        },
        function (err) {
          fb.className = "import-feedback error"; fb.style.display = "";
          fb.textContent = "✕ " + err;
          $("troubleshoot-box").style.display = "";
        }
      );

    } else {
      var text = $("import-textarea").value;
      var parsed = parseWordList(text);
      if (parsed.words.length === 0) {
        fb.className = "import-feedback error"; fb.textContent = "No valid lines found. Check the format."; return;
      }
      state.words = parsed.words;
      state.timeLimitSeconds = minutes * 60;
      saveTime(minutes);
      
      // Xoá cấu hình sheet cũ để tránh conflict dữ liệu khi chạy Paste tab
      try {
        localStorage.removeItem(STORAGE_KEY_CACHE_WORDS);
        localStorage.removeItem(STORAGE_KEY_CACHE_SRC);
      } catch(e) {}

      fb.className = "import-feedback success";
      fb.textContent = parsed.words.length + " word(s) loaded · " + minutes + " min limit." +
        (parsed.skipped ? " (" + parsed.skipped + " skipped)" : "");
      setTimeout(closeModal, 1400);
    }
  });

  // ─── INIT ──────────────────────────────────────────────────────────────────
  autoLoadOnStart();

})();