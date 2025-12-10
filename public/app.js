// API Configuration
// Fallback to localhost if running from file or null origin
const API_BASE = (window.location.protocol === 'file:' || window.location.origin === 'null')
    ? 'http://localhost:3000'
    : window.location.origin;
const UNIVERSITY_URL = "http://moodle.smuc.edu.et/students/SMUC.php";

// State Management
let currentUser = null;
let calculatorCourses = [];

// ==========================================
// Initialization
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    checkStoredSession();

    // Login Form Listener
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Initialize Calculator with one empty row
    addCalcCourse();
});

// ==========================================
// Navigation & Tabs
// ==========================================
function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.add('hidden');
    });

    // Show selected tab with animation
    const selectedTab = document.getElementById(`${tabName}Tab`);
    if (selectedTab) {
        selectedTab.classList.remove('hidden');
        selectedTab.classList.remove('fade-in');
        void selectedTab.offsetWidth; // Trigger reflow for animation
        selectedTab.classList.add('fade-in');
    }

    // ⭐ FIX: Update Bottom Navigation Styling using data-tab
    
    // 1. Remove 'active' class from ALL nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    // 2. Find and add 'active' class to the target nav item
    //    This is robust and reliably triggers the CSS slide effect.
    const navItem = document.querySelector(`.nav-item[data-tab="${tabName}"]`);
    if (navItem) {
        navItem.classList.add('active');
    }
    // --------------------------------------------------------

    // Update Page Title
    const titles = {
        'home': 'Overview',
        'academics': 'Academics',
        'handbook': 'Student Handbook',
        'calculator': 'GPA Calculator',
        'ebooks': 'E-Library'
    };
    document.getElementById('pageTitle').textContent = titles[tabName] || 'SMU HUB';

    // Auto-fetch data for Academics tab
    if (tabName === 'academics') {
        if (!document.querySelector('.academic-view:not(.hidden)')) {
            switchAcademicView('grades');
        } else {
            const currentView = document.querySelector('.segment-btn.active').textContent.toLowerCase();
            handleAcademicViewChange(currentView);
        }
    }

    // Show/hide the refresh button based on the active tab
    const refreshBtn = document.getElementById('refreshButton');
    if (refreshBtn) {
        if (tabName === 'academics') {
            refreshBtn.classList.remove('hidden');
        } else {
            refreshBtn.classList.add('hidden');
        }
    }
}

function switchAcademicView(viewName) {
    // Update Segment Buttons
    document.querySelectorAll('.segment-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.toLowerCase() === viewName) btn.classList.add('active');
    });

    // Show/Hide Views
    document.querySelectorAll('.academic-view').forEach(view => {
        view.classList.add('hidden');
    });
    document.getElementById(`${viewName}View`).classList.remove('hidden');

    // Fetch Data for the view
    handleAcademicViewChange(viewName);
}

function handleAcademicViewChange(viewName) {
    const cachedData = JSON.parse(localStorage.getItem('gradesData'));

    // If we have cached data, display it immediately. Otherwise, fetch it.
    if (cachedData && cachedData.data) {
        if (viewName === 'grades') {
            displayGrades(cachedData.data);
        } else if (viewName === 'deficiency') {
            displayDeficiency(cachedData.data.deficiency);
        }
    } else {
        fetchGrades(); // This will fetch all data and cache it.
    }
}

// ==========================================
// Authentication (Login/Logout)
// ==========================================
// Ensure this is defined outside the function, in the global scope of your script

// The initCalculator function and all other calculator logic must also be defined.

// Global variable, defined at the top of your script


async function handleLogin(e) {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    // UI Loading State
    const loginBtn = document.querySelector('.btn-login');
    const loginBtnText = document.getElementById('loginBtnText');
    const loginSpinner = document.getElementById('loginSpinner');
    const errorDiv = document.getElementById('loginError');

    loginBtn.disabled = true;
    loginBtnText.classList.add('hidden');
    loginSpinner.classList.remove('hidden');
    errorDiv.classList.add('hidden');

    try {
        const response = await fetch(`${API_BASE}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, universityUrl: UNIVERSITY_URL })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // Use the same variable name consistently:
            currentUser = data.username; 
            
            // ⭐️ FIX: Set the variable used by the calculator logic (loggedInUsername)
            // and pass it to the init function.
            loggedInUsername = data.username; 

            // Persist Session
            localStorage.setItem('universitySession', JSON.stringify({
                username: data.username
            }));

            showApp();

            // 1. If server sent back cached data, use it immediately for the grades tab.
            if (data.cachedData) displayGrades(data.cachedData);

            // 2. Initialize the GPA calculator with the current user's data.
            // This is crucial to load the previous semester's courses.
            initCalculator(loggedInUsername); 

            // 3. Pre-load grades (fetchGrades() typically triggers the scrape refresh).
            fetchGrades(); 
        } else {
            throw new Error(data.error || 'Login failed. Please check your credentials.');
        }
    } catch (error) {
        errorDiv.textContent = error.message;
        errorDiv.classList.remove('hidden');
    } finally {
        loginBtn.disabled = false;
        loginBtnText.classList.remove('hidden');
        loginSpinner.classList.add('hidden');
    }
}

function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        // Clear only app-specific data from Local Storage
        localStorage.clear();
        localStorage.removeItem('universitySession');
        localStorage.removeItem('gradesData');

        // Reset State
        // currentSession = null; // No longer used
        currentUser = null;

        // Reset UI
        document.getElementById('mainApp').classList.add('hidden');
        document.getElementById('loginScreen').classList.remove('hidden');
        document.getElementById('loginForm').reset();

        // Close modal if open
        const modal = document.getElementById('profileModal');
        if (!modal.classList.contains('hidden')) {
            modal.classList.add('hidden');
        }
    }
}

function showApp() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    updateHeaderInfo();
}

function checkStoredSession() {
    const stored = localStorage.getItem('universitySession');
    if (stored) {
        const sessionData = JSON.parse(stored);
        currentUser = sessionData.username;
        // ⭐️ FIX 1: Ensure the calculator's state variable is set
        // Assuming loggedInUsername is the global variable used by initCalculator
        loggedInUsername = currentUser; 
        
        showApp();

        // ⭐️ FIX 1: Initialize the calculator upon session check (on refresh)
        initCalculator(loggedInUsername); 
        
        // Load cached data if available and not too old
        const cachedData = JSON.parse(localStorage.getItem('gradesData'));
        if (cachedData && cachedData.data) {
            const cacheTimestamp = new Date(cachedData.timestamp);
            const now = new Date();
            const hoursSinceCache = (now - cacheTimestamp) / (1000 * 60 * 60);

            displayGrades(cachedData.data);

            // Refresh data in the background if cache is older than 6 hours
            if (hoursSinceCache > 6) fetchGrades();
        } else fetchGrades(); // Fetch if no cache
    }
}

// ==========================================
// Profile & UI Updates
// ==========================================
function toggleProfileModal() {
    const modal = document.getElementById('profileModal');
    if (modal.classList.contains('hidden')) {
        modal.classList.remove('hidden');
        updateProfileModal();
    } else {
        modal.classList.add('hidden');
    }
}

function updateHeaderInfo() {
    if (currentUser) {
        document.getElementById('userInitials').textContent = currentUser.substring(0, 2).toUpperCase();
        document.getElementById('headerUserId').textContent = `ID: ${currentUser}`;
    }
}

function updateProfileModal() {
    // ⭐ FIX: Read from 'gradesData' which contains the full data object
    const cachedData = localStorage.getItem('gradesData');
    if (cachedData) {
        const { data } = JSON.parse(cachedData); // Destructure to get the 'data' object
        if (data.student) {
            document.getElementById('modalName').textContent = data.student.fullName || 'Student';
            document.getElementById('modalId').textContent = `ID: ${data.student.studentId || currentUser}`;
            document.getElementById('modalInitials').textContent = (data.student.fullName || 'ST').substring(0, 2).toUpperCase();

            // Populate grid
            const grid = document.getElementById('profileInfoGrid');
            grid.innerHTML = `
                <div class="profile-item">
                    <div class="profile-label">Department</div>
                    <div class="profile-value">${data.student.department || '-'}</div>
                </div>
                <div class="profile-item">
                    <div class="profile-label">Program</div>
                    <div class="profile-value">${data.student.program || '-'}</div>
                </div>
                <div class="profile-item">
                    <div class="profile-label">Division</div>
                    <div class="profile-value">${data.student.division || '-'}</div>
                </div>
                <div class="profile-item">
                    <div class="profile-label">Section</div>
                    <div class="profile-value">${data.student.section || '-'}</div>
                </div>
            `;
        }
    }
}



// ==========================================
// Data Fetching & Display
// ==========================================
async function fetchGrades(forceRefresh = false) {
    if (!currentUser) return;

    const refreshBtn = document.getElementById('refreshButton');
    const refreshIcon = document.getElementById('refreshIcon');
    const refreshSpinner = document.getElementById('refreshSpinner');

    // Show loading state on the refresh button if it was clicked
    if (forceRefresh) {
        refreshBtn.disabled = true;
        refreshIcon.classList.add('hidden');
        refreshSpinner.classList.remove('hidden');
    } else {
        // For initial load, show a spinner in the content area if it's empty
        const contentArea = document.getElementById('gradesContent');
        if (!contentArea.querySelector('table') && !contentArea.querySelector('.card')) {
            contentArea.innerHTML = '<div class="spinner-large"></div>';
        }
    }


    try {
        // Use the new 'refresh' endpoint for forced updates
        const endpoint = forceRefresh ? `${API_BASE}/api/grades/refresh` : `${API_BASE}/api/grades`;
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            if (forceRefresh) {
                if (data.dataChanged) {
                    showToast('Academic records updated successfully!');
                } else {
                    showToast('Your records are already up to date.');
                }
            }

            // Always update cache and display, even if data hasn't changed,
            // to ensure consistency.
            const cachePayload = { timestamp: new Date().toISOString(), data: data.data };
            localStorage.setItem('gradesData', JSON.stringify(cachePayload));

            // Re-render the currently active academic view
            const currentView = document.querySelector('.segment-btn.active').textContent.toLowerCase();
            if (currentView === 'grades') {
                displayGrades(data.data);
            } else if (currentView === 'deficiency') {
                displayDeficiency(data.data.deficiency);
            }

        } else {
            // Use the specific error from the server if available
            const errorMessage = data.error || 'Failed to fetch grades';
            throw new Error(errorMessage);
        }
    } catch (error) {
        console.error('Fetch Grades Error:', error);
        if (forceRefresh) {
            showToast(error.message, 'error');
        } else {
            const contentArea = document.getElementById('gradesContent');
            contentArea.innerHTML = `<div class="error-message">${error.message}<br><button onclick="fetchGrades(true)" style="margin-top:10px;">Retry</button></div>`;
        }
    } finally {
        refreshBtn.disabled = false;
        refreshIcon.classList.remove('hidden');
        refreshSpinner.classList.add('hidden');
    }
}

// ⭐ REFACTORED: This function now takes the deficiency array directly.
function displayDeficiency(data) {
    const contentArea = document.getElementById('deficiencyContent');

    // The data is now the array itself, not an object containing it.
    if (!data || data.length === 0) {
        contentArea.innerHTML = `<div class="card" style="padding: 20px; text-align: center;">
            <div style="font-size: 1.2rem; font-weight: 600; color: var(--success-color);">
                🎉 Congratulations!
            </div>
            <p style="margin-top: 5px; color: var(--text-secondary);">
                You have **No Academic Deficiency** recorded.
            </p>
        </div>`;
        return;
    }

    let html = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>Course Title</th>
                    <th>Code</th>
                    <th>Credit</th>
                </tr>
            </thead>
            <tbody>
    `;

    data.forEach(item => {
        html += `
            <tr>
                <td data-label="#">${item.number || '-'}</td>
                <td data-label="Course Title">${item.courseTitle || '-'}</td>
                <td data-label="Code">${item.courseCode || '-'}</td>
                <td data-label="Credit">${item.creditHour || '-'}</td>
            </tr>
        `;
    });

    html += `</tbody></table>`;
    contentArea.innerHTML = html;
}

function displayGrades(data) {
    const content = document.getElementById("gradesContent");

    // Check for necessary data keys
    if (!data || (!data.gradeSummary && !data.exemptedCourses)) {
        content.innerHTML = "<div class='card'>No records found.</div>";
        return;
    }

    const semesters = data.gradeSummary || []; 
    const exempted = data.exemptedCourses || [];

    let html = "";
    
    
    // ----------------------------------------------------
    // 1. EXEMPTED COURSES (New Accordion)
    // ----------------------------------------------------
    const exemptedId = "exempted-courses-body";
    html += `
        <div class="card section-card exempted-card">
            <div class="accordion-header" onclick="toggleSemester('${exemptedId}', this)">
                <div class="card-title">Exempted Courses</div>
                <i class="expand-icon fas fa-chevron-down"></i>
            </div>
            
            <div class="accordion-body" id="${exemptedId}" style="display:none; padding: 0;">
                <table class="data-table exempted-table">
                    <thead>
                        <tr>
                            <th data-label="Code">Course Code</th>
                            <th data-label="Title">Course Name</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    if (exempted.length === 0) {
        html += `<tr><td colspan="2" style="text-align:center;color:var(--text-secondary)">No exempted courses</td></tr>`;
    } else {
        exempted.forEach(c => {
            html += `
                <tr>
                    <td data-label="Code">${c.code}</td> 
                    <td data-label="Title">${c.title}</td> 
                </tr>
            `;
        });
    }

    html += `</tbody></table></div></div>`;


    // ----------------------------------------------------
    // 2. SEMESTERS (Outer Accordion)
    // ----------------------------------------------------
    semesters.forEach((sem, semIndex) => {
        const semId = `semester-${semIndex}`;

        html += `
        <div class="card semester-card">

            <div class="accordion-header semester-header" onclick="toggleSemester('${semId}', this)">
                <div class="header-details">
                    <div class="card-title">Year ${sem.year} • Semester ${sem.semester}</div>
                </div>

                <div class="gpa-container">
                    
                    <div class="gpa-box sgpa-box">
                        <div class="gpa-label">SGPA</div>
                        <div class="gpa-value">${sem.semesterGPA || "-"}</div>
                    </div>
                    
                    <div class="gpa-box cgpa-box">
                        <div class="gpa-label cgpa-label">CGPA</div>
                        <div class="gpa-value cgpa-value">${sem.cumulativeGPA || "-"}</div>
                    </div>
                </div>
                
                <i class="expand-icon fas fa-chevron-down"></i>
            </div>

            <div class="accordion-body" id="${semId}" style="display:none; padding: 0;">
        `;
        
        if (sem.courses.length === 0) {
            html += `<div style="text-align:center; padding: 15px; color: var(--text-secondary);">No courses found for this semester.</div>`;
        } else {
            // ----------------------------------------------------
            // 3. COURSES (Inner Accordion)
            // ----------------------------------------------------
            sem.courses.forEach((course, courseIndex) => {
                const courseId = `course-${semIndex}-${courseIndex}`;
                const res = course.resultColumns || [null, null, null, null, null]; 
                
                // Inner Accordion Header: Course Code/Name, Cr, Grade
                html += `
                <div class="course-item">
                    <div class="course-header" onclick="toggleSemester('${courseId}', this)">
                        <div class="course-info">
                            <div class="course-code">${course.courseCode}</div>
                            <div class="course-name">${course.courseName}</div>
                        </div>

                        <div class="course-meta">
                            <div class="meta-item">
                                <div class="meta-label">Cr</div>
                                <div class="meta-value">${course.creditHours || "-"}</div>
                            </div>
                            <div class="meta-item grade-item">
                                <div class="meta-label">Grade</div>
                                <div class="meta-value grade-value" style="color:${course.grade === 'F' ? 'var(--danger-color)' : 'var(--primary-color)'};">
                                    ${course.grade || "-"}
                                </div>
                            </div>
                        </div>
                        
                        <i class="expand-icon fas fa-chevron-down small-icon"></i>
                    </div>

                    <div class="course-details accordion-body" id="${courseId}" style="display:none;">
                        <table class="data-table details-table">
                            <thead>
                                <tr>
                                    <th class="res-col">R1</th>
                                    <th class="res-col">R2</th>
                                    <th class="res-col">R3</th>
                                    <th class="res-col">R4</th>
                                    <th class="res-col">R5</th>
                                    <th class="total-col">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td class="res-col" data-label="R1">${res[0] ?? "-"}</td>
                                    <td class="res-col" data-label="R2">${res[1] ?? "-"}</td>
                                    <td class="res-col" data-label="R3">${res[2] ?? "-"}</td>
                                    <td class="res-col" data-label="R4">${res[3] ?? "-"}</td>
                                    <td class="res-col" data-label="R5">${res[4] ?? "-"}</td>
                                    <td class="total-col" data-label="Total">${course.total ?? "-"}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                `;
            });
        }
        
        html += `
            </div>
        </div>`;
    });

    content.innerHTML = html;
}

// Keep the existing toggle function:
function toggleSemester(id, headerElement) {
    const element = document.getElementById(id);
    const icon = headerElement.querySelector('.expand-icon');

    if (element.style.display === "none" || element.style.display === "") {
        element.style.display = "block";
        icon.style.transform = "rotate(180deg)";
    } else {
        element.style.display = "none";
        icon.style.transform = "rotate(0deg)";
    }
}

// ==========================================
// UI Components (Toast)
// ==========================================
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = 'toast show'; // Reset and show
    if (type === 'error') {
        toast.classList.add('error');
    }

    // Hide after 3 seconds
    setTimeout(() => {
        toast.className = toast.className.replace('show', '');
    }, 3000);
}


// ==========================================
// Global State for Calculator
// ==========================================
let allScrapedData = null; // Stores all cached data for CGPA calculation
let loggedInUsername = null; // MUST be set on successful login for reset to work

// ==========================================
// GPA Conversion Logic (St. Mary's University Scale)
// ==========================================

/**
 * Returns the letter grade (e.g., 'A+', 'B') corresponding to the score.
 */
function getLetterGrade(score) {
    score = parseFloat(score);
    if (isNaN(score) || score < 0) return 'N/A';
    
    // Scale: Grade, Score Range
    if (score >= 92) return 'A+';
    if (score >= 86) return 'A';
    if (score >= 80) return 'A-';
    if (score >= 74) return 'B+';
    if (score >= 68) return 'B';
    if (score >= 62) return 'B-';
    if (score >= 56) return 'C+';
    if (score >= 50) return 'C';
    if (score >= 44) return 'C-';
    if (score >= 38) return 'D+';
    if (score >= 32) return 'D';
    if (score <= 31) return 'F';
    
    return 'F'; 
}

/**
 * Returns the grade point (e.g., 4.0, 3.0) corresponding to the score.
 */
function getGradePoint(score) {
    score = parseFloat(score);
    if (isNaN(score)) return 0.0;
    
    // Scale: Grade Point, Score Range
    if (score >= 92) return 4.00; 
    if (score >= 86) return 4.00; 
    if (score >= 80) return 3.75; 
    if (score >= 74) return 3.50; 
    if (score >= 68) return 3.00; 
    if (score >= 62) return 2.75; 
    if (score >= 56) return 2.50; 
    if (score >= 50) return 2.00; 
    if (score >= 44) return 1.75; 
    if (score >= 38) return 1.25; 
    if (score >= 32) return 1.00; 
    if (score <= 31) return 0.00; 
    
    return 0.00; 
}


// ==========================================
// Core Calculator Functions
// ==========================================


function addCalcCourse(courseTitle = '', creditHour = 0, defaultScore = 0) {
    const id = Date.now() + Math.random(); // Ensure unique ID
    const isFetchedCourse = creditHour > 0;
    
    // ⭐ FIX 1: Conditional rendering of the course title
    const courseTitleElement = isFetchedCourse
        ? `<div class="title static-title">${courseTitle}</div>` // Static text for fetched courses
        : `<input type="text" class="title title-input" placeholder="Course Title" value="${courseTitle}">`; // Editable input for new courses
    
    // ⭐ NEW GRID-BASED HTML STRUCTURE
    const html = `
        <div class="row course-row" id="row-${id}">
            
            ${courseTitleElement} <div>
                <input type="number" class="credit-input" placeholder="Cr" value="${creditHour}" onchange="calculateGPA()" min="1" ${isFetchedCourse ? 'disabled' : ''}>
            </div>
            <div>
                <input type="number" class="score-input" placeholder="--" value="${defaultScore > 0 ? defaultScore : ''}" 
                    onchange="calculateGPA()" 
                    oninput="this.value=(this.value>100?100:(this.value<0?0:this.value)); calculateGPA()" min="0" max="100">
            </div>
            <div class="grade" id="grade-${id}">--</div>
            <div class="action-btn" onclick="removeCalcCourse(${id})">X</div>
        </div>
    `;
    document.getElementById('calcCourses').insertAdjacentHTML('beforeend', html);
    calculateGPA(); 
}

function removeCalcCourse(id) {
    document.getElementById(`row-${id}`).remove();
    calculateGPA();
}

/**
 * Resets the calculator by re-initializing it with the loaded data.
 */
function resetCalculator() {
    if (loggedInUsername) {
        initCalculator(loggedInUsername);
    } else {
        // Fallback if the user has not logged in yet or session expired
        document.getElementById('calcCourses').innerHTML = '';
        addCalcCourse('Example Course', 3, 0);
        calculateGPA();
    }
}

/**
 * Performs the SGPA and CGPA projection calculations and updates letter grades.
 */
function calculateGPA() {
    
    const rows = document.querySelectorAll('.course-row'); 
    
    let totalPoints = 0;
    let totalCredits = 0;

    // --- 1. Calculate Projected SGPA and Update Letter Grade Displays ---
    rows.forEach(row => {
        // The HTML structure changed, so we need to find the specific inputs within the row
        // We can't rely on the inputs array indices anymore (inputs[1], inputs[2])
        const credits = parseFloat(row.querySelector('.credit-input').value) || 0;
        const rawScore = parseFloat(row.querySelector('.score-input').value) || 0; 
        
        // Calculate and display the letter grade
        const letterGrade = getLetterGrade(rawScore);
        
        // The row ID is 'row-123456', so split('-')[1] gets '123456'
        const gradeDisplayId = `grade-${row.id.split('-')[1]}`;
        document.getElementById(gradeDisplayId).textContent = letterGrade;

        // Convert 0-100 score to Grade Point
        const gradePoint = getGradePoint(rawScore); 

        if (credits > 0 && rawScore >= 0) {
            totalPoints += (credits * gradePoint);
            totalCredits += credits;
        }
    });

    const projectedSGPA = totalCredits > 0 ? (totalPoints / totalCredits) : 0.0;
    document.getElementById('calcSGPA').textContent = projectedSGPA.toFixed(2);


    // --- 2. Calculate Projected CGPA (Sum of SGPAs / Semester Count) ---
    let historicalSumOfSGPAs = 0;
    let historicalSemesterCount = 0;
    
    if (allScrapedData && allScrapedData.gradeSummary) {
        allScrapedData.gradeSummary.forEach(sem => {
            // Use the actual semesterGPA field from the scraped data
            const sgpa = parseFloat(sem.semesterGPA); 
            if (!isNaN(sgpa) && sgpa > 0) {
                historicalSumOfSGPAs += sgpa;
                historicalSemesterCount += 1;
            }
        });
    }

    let sumOfAllSGPAs = historicalSumOfSGPAs;
    let totalSemesterCount = historicalSemesterCount;
    
    // Only count the projected semester if it contains courses and a calculated SGPA
    if (projectedSGPA > 0 && totalCredits > 0) {
        sumOfAllSGPAs += projectedSGPA;
        totalSemesterCount += 1;
    }

    const projectedCGPA = totalSemesterCount > 0 ? (sumOfAllSGPAs / totalSemesterCount) : 0.0;
    document.getElementById('calcCGPA').textContent = projectedCGPA.toFixed(2);
}


// ==========================================
// Initialization (Loads data from cache)
// ==========================================

async function initCalculator(username) {
    document.getElementById('calcCourses').innerHTML = ''; // Clear existing rows
    allScrapedData = null; // Reset data

    // Fetch the cached data from the server
    const response = await fetch('/api/grades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username })
    });
    const data = await response.json();

    // Check if we have valid grade history
    if (!data.success || !data.data || !data.data.gradeSummary) {
        console.warn("Could not load historical data for calculator.");
        addCalcCourse('Example Course', 3, 0); // Default blank row
        return;
    }

    allScrapedData = data.data;
    const gradeSummary = allScrapedData.gradeSummary;
    
    // ⭐️ NEW ROBUST LOGIC: Find the most recent semester that actually contains courses
    let coursesToUse = [];

    // Iterate backwards through the semester history (from last to first)
    for (let i = gradeSummary.length - 1; i >= 0; i--) {
        const semester = gradeSummary[i];
        if (semester.courses && semester.courses.length > 0) {
            coursesToUse = semester.courses;
            console.log(`Initialized calculator using courses from Year ${semester.year}, Semester ${semester.semester}.`);
            break; // Found a list of courses, stop searching
        }
    }

    if (coursesToUse.length > 0) {
        coursesToUse.forEach(course => {
            // Only add courses with valid credit hours
            const creditHr = parseFloat(course.creditHours);
            if (creditHr > 0) {
                // Initial score set to 80 as a default guess for projection
                addCalcCourse(course.courseName, creditHr, 80); 
            }
        });
    } else {
        // If no courses were found in any semester (e.g., brand new student)
        console.warn("No courses found in historical data. Adding a blank row.");
        addCalcCourse('Example Course', 3, 0);
    }
}