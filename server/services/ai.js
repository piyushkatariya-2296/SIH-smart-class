const fs = require('fs');
require('dotenv').config();

// Helper to check if API key exists
const getGeminiKey = () => process.env.GEMINI_API_KEY || null;
const getOpenAIKey = () => process.env.OPENAI_API_KEY || null;

// Determine if we are in mock mode
const isMockMode = () => !getGeminiKey() && !getOpenAIKey();

/**
 * Speech-To-Text: Transcribes audio buffer to raw text.
 * Internally uses Gemini inline_data audio or OpenAI Whisper, with contextual mock fallback.
 */
async function transcribeAudio(audioBuffer, mimeType, lectureTitle = '', lectureDesc = '') {
  console.log(`Transcribing audio. Size: ${audioBuffer.length} bytes, MimeType: ${mimeType}`);
  
  if (isMockMode()) {
    console.log('AI API keys not configured. Running in Mock STT mode...');
    // Introduce a delay to simulate transcription
    await new Promise(r => setTimeout(r, 2000));
    return generateMockTranscript(lectureTitle, lectureDesc);
  }

  // 1. Try Gemini
  const geminiKey = getGeminiKey();
  if (geminiKey) {
    try {
      console.log('Using Gemini for Native Audio Transcription...');
      const base64Audio = audioBuffer.toString('base64');
      
      const payload = {
        contents: {
          parts: [
            {
              inline_data: {
                mime_type: mimeType || 'audio/webm',
                data: base64Audio
              }
            },
            {
              text: "Listen to this audio and write a complete, accurate, word-for-word transcript of the lecture. Do not add any introduction, explanations, or commentary. Just output the transcript."
            }
          ]
        }
      };

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini transcription request failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text.trim();
      throw new Error('Gemini API returned an empty response');
    } catch (err) {
      console.error('Gemini STT failed, trying Whisper...', err.message);
    }
  }

  // 2. Try OpenAI Whisper
  const openaiKey = getOpenAIKey();
  if (openaiKey) {
    try {
      console.log('Using OpenAI Whisper for Transcription...');
      // Whisper requires multipart upload
      const formData = new FormData();
      const fileBlob = new Blob([audioBuffer], { type: mimeType || 'audio/webm' });
      formData.append('file', fileBlob, 'audio.webm');
      formData.append('model', 'whisper-1');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Whisper request failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return data.text;
    } catch (err) {
      console.error('OpenAI Whisper STT failed:', err.message);
    }
  }

  // Fallback to mock if both APIs failed
  console.log('Transcription APIs failed. Falling back to Mock STT...');
  return generateMockTranscript(lectureTitle, lectureDesc);
}

/**
 * Lecture Notes Generator: Summarizes transcript, creates structured notes,
 * key takeaways, and 3-5 practice questions.
 */
async function generateNotes(transcript) {
  console.log(`Generating study notes from transcript (${transcript.length} characters)...`);

  if (isMockMode()) {
    console.log('AI API keys not configured. Running in Mock Notes Generator mode...');
    await new Promise(r => setTimeout(r, 2000));
    return generateMockNotesContent(transcript);
  }

  const prompt = `
  You are an expert AI Educator. Analyze the following lecture transcript and generate structured study materials.
  
  Transcript:
  "${transcript}"
  
  You MUST return your response as a valid JSON object ONLY. Do not write markdown formatting outside the JSON code block. Do not include any HTML. The JSON must match the following schema:
  {
    "summary": "A detailed 2-3 paragraph executive summary of the lecture.",
    "structured_notes": "Highly detailed, well-structured study notes in Markdown format, using headers (###), bullet points, and bold text for important terms.",
    "key_points": [
      "Key point 1",
      "Key point 2",
      "Key point 3",
      "Key point 4",
      "Key point 5"
    ],
    "practice_questions": [
      {
        "question": "Clear multiple-choice practice question based on the lecture.",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "answer": "A",
        "explanation": "Brief explanation of why this answer is correct."
      }
    ]
  }
  
  Ensure there are between 3 and 5 practice questions. Return only raw JSON matching this schema.
  `;

  // 1. Try Gemini
  const geminiKey = getGeminiKey();
  if (geminiKey) {
    try {
      console.log('Using Gemini for Notes Generation...');
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: { parts: [{ text: prompt }] },
          generationConfig: {
            responseMimeType: "application/json"
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        const rawJsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawJsonText) {
          return JSON.parse(rawJsonText);
        }
      } else {
        const errText = await response.text();
        console.warn(`Gemini generation failed: ${response.status} - ${errText}`);
      }
    } catch (err) {
      console.error('Gemini Notes generation failed, trying OpenAI...', err.message);
    }
  }

  // 2. Try OpenAI
  const openaiKey = getOpenAIKey();
  if (openaiKey) {
    try {
      console.log('Using OpenAI for Notes Generation...');
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are an AI assistant that only outputs JSON.' },
            { role: 'user', content: prompt }
          ],
          response_format: { type: 'json_object' }
        })
      });

      if (response.ok) {
        const data = await response.json();
        const rawJsonText = data.choices?.[0]?.message?.content;
        if (rawJsonText) {
          return JSON.parse(rawJsonText);
        }
      }
    } catch (err) {
      console.error('OpenAI Notes generation failed:', err.message);
    }
  }

  // Fallback to mock
  console.log('Notes Generation APIs failed. Falling back to Mock Notes...');
  return generateMockNotesContent(transcript);
}

/**
 * Remedial Slide Deck Generator: Drafts a slide deck in JSON format
 * for a student struggling in a specific topic.
 */
async function generateRemedialSlides(studentName, topic) {
  console.log(`Generating remedial slide deck for ${studentName} on topic "${topic}"...`);

  if (isMockMode()) {
    console.log('AI API keys not configured. Running in Mock Remedial Slides mode...');
    await new Promise(r => setTimeout(r, 2000));
    return generateMockSlidesContent(studentName, topic);
  }

  const prompt = `
  You are an expert tutor. Create a personalized, simplified remedial learning slide deck for a student named ${studentName} who is struggling with the topic: "${topic}".
  
  Use simpler language, clear analogies, one concrete step-by-step worked example, and 3 extra practice questions.
  
  You MUST return your response as a valid JSON object ONLY. Do not write markdown formatting outside the JSON code block. Do not include any HTML. The JSON must match the following schema:
  {
    "title": "Remedial Slide Deck Title (e.g. Mastering Photosynthesis or Algebra Made Easy)",
    "topic": "${topic}",
    "student_name": "${studentName}",
    "slides": [
      {
        "slide_number": 1,
        "title": "Title of Slide",
        "bullets": [
          "Key bullet point 1 in simple terms",
          "Key bullet point 2 using easy vocabulary"
        ],
        "analogy": "A simple real-world analogy to explain the concept (optional)."
      }
    ],
    "worked_example": {
      "problem": "The math/science problem statement",
      "steps": [
        "Step 1 explanation & calculation",
        "Step 2 explanation & calculation",
        "Step 3 explanation & calculation"
      ],
      "final_solution": "The final answer clearly written"
    },
    "extra_practice_questions": [
      {
        "question": "Practice question 1",
        "options": ["A", "B", "C", "D"],
        "answer": "A",
        "explanation": "Why this option is correct."
      }
    ]
  }
  
  Ensure there are at least 4 slides inside the "slides" list, followed by the worked_example and the 3 extra_practice_questions. Return only raw JSON.
  `;

  // 1. Try Gemini
  const geminiKey = getGeminiKey();
  if (geminiKey) {
    try {
      console.log('Using Gemini for Remedial Slides...');
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: { parts: [{ text: prompt }] },
          generationConfig: {
            responseMimeType: "application/json"
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        const rawJsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawJsonText) {
          return JSON.parse(rawJsonText);
        }
      }
    } catch (err) {
      console.error('Gemini Remedial generation failed, trying OpenAI...', err.message);
    }
  }

  // 2. Try OpenAI
  const openaiKey = getOpenAIKey();
  if (openaiKey) {
    try {
      console.log('Using OpenAI for Remedial Slides...');
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are an AI assistant that only outputs JSON.' },
            { role: 'user', content: prompt }
          ],
          response_format: { type: 'json_object' }
        })
      });

      if (response.ok) {
        const data = await response.json();
        const rawJsonText = data.choices?.[0]?.message?.content;
        if (rawJsonText) {
          return JSON.parse(rawJsonText);
        }
      }
    } catch (err) {
      console.error('OpenAI Remedial generation failed:', err.message);
    }
  }

  // Fallback to mock
  console.log('Remedial Generation APIs failed. Falling back to Mock slides...');
  return generateMockSlidesContent(studentName, topic);
}

/* =========================================================================
   MOCK GENERATOR HELPERS
   ========================================================================= */

function generateMockTranscript(title = '', desc = '') {
  const t = title.toLowerCase();
  const d = desc.toLowerCase();
  
  if (t.includes('mitosis') || d.includes('mitosis') || t.includes('cell') || d.includes('cell') || t.includes('biology') || d.includes('biology')) {
    return `Hello everyone, welcome to today's biology lecture. Today, we are diving deep into the fascinating process of cell division, specifically focusing on mitosis. Mitosis is the process where a single cell divides into two identical daughter cells. The cell division occurs in several phases, and I want you to remember the acronym PMAT: Prophase, Metaphase, Anaphase, and Telophase. 
    First, during Prophase, the chromatin condenses into visible chromosomes, and the nuclear envelope starts to break down. Spindle fibers begin to form from the centrioles.
    Second is Metaphase. During Metaphase, the chromosomes line up perfectly along the center of the cell, which we call the metaphase plate. The spindle fibers attach to the centromere of each chromosome.
    Third is Anaphase. During this critical stage, the sister chromatids are pulled apart by the spindle fibers towards opposite poles of the cell. This ensures each new cell will get an exact copy of the DNA.
    Finally, we have Telophase. The chromosomes reach the poles, a new nuclear membrane forms around each set of chromosomes, and the chromosomes begin to uncoil back into chromatin. Cytokinesis usually happens at the same time, splitting the cytoplasm and completing the division into two cells.
    Mitosis is essential for growth, tissue repair, and asexual reproduction. Make sure you study the PMAT stages and understand what occurs in each! Let me know if you have questions.`;
  }
  
  if (t.includes('algebra') || d.includes('algebra') || t.includes('equation') || d.includes('equation') || t.includes('linear') || d.includes('linear') || t.includes('math') || d.includes('math')) {
    return `Welcome back class. Today, we are going to learn how to solve simple linear equations. A linear equation is an equation for a straight line, and our goal is always to isolate the variable, usually x, on one side of the equation.
    Let's look at an equation: 3x plus 5 equals 17. How do we solve this?
    Remember the golden rule of algebra: whatever you do to one side of the equation, you must do to the other side to keep it balanced.
    Step one is to isolate the term with the variable. Here, we have a plus 5 on the left. To cancel out a plus 5, we perform the inverse operation, which is subtraction. So, we subtract 5 from both sides. On the left, 3x plus 5 minus 5 leaves us with 3x. On the right, 17 minus 5 gives us 12. So now, our simplified equation is 3x equals 12.
    Step two is to isolate the variable x. Currently, x is multiplied by 3. The inverse operation of multiplication is division. Therefore, we divide both sides by 3. On the left, 3x divided by 3 is just x. On the right, 12 divided by 3 is 4.
    So our solution is x equals 4.
    We can verify this by plugging x equals 4 back into the original equation: 3 times 4 is 12, plus 5 is 17. The equation holds true!
    Remember to always perform operations in the reverse order of operations (PEMDAS), so do additions and subtractions first to clear constants, then do multiplications and divisions to clear coefficients. Let's try some practice problems.`;
  }
  
  if (t.includes('photosynthesis') || d.includes('photosynthesis') || t.includes('plant') || d.includes('plant') || t.includes('chloroplast') || d.includes('chloroplast')) {
    return `Good morning. Today, we are discussing photosynthesis, which is one of the most important chemical processes on Earth. Photosynthesis is the process used by plants, algae, and certain bacteria to harness energy from sunlight and turn it into chemical energy, specifically glucose.
    This process takes place inside a specialized organelle in plant cells called the chloroplast. Chloroplasts contain chlorophyll, which is the green pigment that absorbs light energy, primarily blue and red wavelengths, while reflecting green.
    Let's look at the chemical equation for photosynthesis. The reactants are carbon dioxide and water. In the presence of sunlight, chlorophyll converts these reactants into glucose and oxygen. The balanced chemical formula is 6CO2 plus 6H2O, under sunlight, yields C6H12O6 plus 6O2.
    This process occurs in two main stages. The first stage is the Light-Dependent Reactions, which take place in the thylakoid membranes of the chloroplast. Here, solar energy is captured and converted into chemical energy carriers like ATP and NADPH, releasing oxygen as a byproduct by splitting water molecules.
    The second stage is the Light-Independent Reactions, also known as the Calvin Cycle, which takes place in the stroma of the chloroplast. This stage does not require direct sunlight. It uses the ATP and NADPH generated in the first stage, along with carbon dioxide from the air, to synthesize glucose.
    So, in summary, plants take in carbon dioxide and water, absorb sunlight, and produce food in the form of glucose while releasing oxygen into the atmosphere. This oxygen is what we and other animals breathe! Make sure you memorize the chemical equation.`;
  }

  // General default educational lecture
  return `Welcome to today's lecture. Today, we will discuss the scientific method, which is the foundation of modern scientific inquiry. The scientific method is a structured process of investigation used to test hypotheses and gain new knowledge.
  The process starts with Observation. You observe a phenomenon and ask a question about why or how it happens.
  Next is Hypothesis formulation. A hypothesis is a proposed explanation that is testable and falsifiable. It is not just a guess, but an educated statement based on prior knowledge.
  Then, we perform Experiments. We design a controlled test to see if our hypothesis is correct. In a controlled experiment, we change one independent variable and measure the effect on a dependent variable, while keeping all other control variables constant.
  Following the experiment, we do Data Collection and Analysis. We look at the numbers, create graphs, and use statistics to see if the data supports or refutes the hypothesis.
  Finally, we draw a Conclusion. If the data supports the hypothesis, we communicate the results. If not, we refine our hypothesis and design a new experiment.
  This cyclical process of observation, hypothesis, experimentation, and refinement is how science progresses. Remember the steps of the scientific method for your quiz!`;
}

function generateMockNotesContent(transcript) {
  const text = transcript.toLowerCase();
  
  if (text.includes('mitosis') || text.includes('cell division')) {
    return {
      summary: "This lecture introduces mitosis, the crucial process of cellular division where a single somatic cell splits into two identical daughter cells. The teacher highlights the step-by-step phases of chromosome separation using the PMAT acronym (Prophase, Metaphase, Anaphase, Telophase), emphasizing its importance in growth, tissue repair, and asexual reproduction.",
      structured_notes: `### Biology Lecture: The Phases of Mitosis

#### Introduction
*   **Mitosis**: The process of nuclear division in eukaryotic cells that occurs when a parent cell divides to produce two identical daughter cells.
*   **Purpose**: Crucial for growth, tissue repair, and asexual reproduction.
*   **Acronym**: **PMAT** is the easy way to remember the sequence of stages.

---

#### The Four Stages of Mitosis (PMAT)

1.  **Prophase**
    *   Chromatin condenses into visible chromosomes. Each chromosome consists of two sister chromatids joined at a centromere.
    *   The nuclear membrane begins to dissolve.
    *   Centrioles move to opposite poles and start generating spindle fibers.

2.  **Metaphase**
    *   Chromosomes line up along the equator of the cell, known as the **metaphase plate**.
    *   Spindle fibers attach to the kinetochores on the centromere of each chromosome.
    *   Key checkpoint: ensures chromosomes are aligned for equal distribution.

3.  **Anaphase**
    *   Spindle fibers contract and pull sister chromatids apart.
    *   Once separated, each chromatid is considered an individual chromosome.
    *   Chromosomes move towards opposite poles of the cell.

4.  **Telophase**
    *   Chromosomes arrive at opposite poles and begin to uncoil back into loose chromatin.
    *   A new nuclear envelope forms around each set of chromosomes.
    *   Spindle fibers disassemble.

---

#### Cytokinesis
*   While mitosis is the division of the *nucleus*, **cytokinesis** is the division of the *cytoplasm*.
*   Typically occurs concurrently with Telophase, resulting in two distinct, genetically identical cells.`,
      key_points: [
        "Mitosis results in two genetically identical daughter cells.",
        "The PMAT acronym represents: Prophase, Metaphase, Anaphase, and Telophase.",
        "Chromosomes line up in the center during Metaphase.",
        "Sister chromatids are pulled to opposite sides during Anaphase.",
        "Cytokinesis splits the cytoplasm, finalizing the cell division."
      ],
      practice_questions: [
        {
          question: "Which of the following describes the correct order of the phases of mitosis?",
          options: ["Metaphase, Prophase, Anaphase, Telophase", "Prophase, Metaphase, Anaphase, Telophase", "Anaphase, Prophase, Metaphase, Telophase", "Prophase, Anaphase, Metaphase, Telophase"],
          answer: "B",
          explanation: "The correct sequence is PMAT: Prophase, Metaphase, Anaphase, and Telophase."
        },
        {
          question: "During which phase do the sister chromatids separate and move to opposite poles?",
          options: ["Prophase", "Metaphase", "Anaphase", "Telophase"],
          answer: "C",
          explanation: "In Anaphase, the spindle fibers pull the sister chromatids apart to opposite ends of the cell."
        },
        {
          question: "What is the difference between mitosis and cytokinesis?",
          options: [
            "Mitosis is cell division in plants; cytokinesis is in animals",
            "Mitosis is the division of cytoplasm; cytokinesis is division of the nucleus",
            "Mitosis is the division of the nucleus; cytokinesis is division of the cytoplasm",
            "There is no difference; they are identical terms"
          ],
          answer: "C",
          explanation: "Mitosis refers strictly to the division of the cell nucleus, whereas cytokinesis is the physical division of the surrounding cytoplasm into two cells."
        }
      ]
    };
  }

  if (text.includes('algebra') || text.includes('equation') || text.includes('linear')) {
    return {
      summary: "This mathematics lecture covers how to solve basic linear equations by isolating the variable. The instructor outlines the 'golden rule of algebra'—maintaining balance by doing identical operations to both sides—and explains how to reverse operations systematically to solve for x, utilizing additions/subtractions first, followed by multiplications/divisions.",
      structured_notes: `### Mathematics Lecture: Solving Linear Equations

#### Core Concepts
*   **Linear Equation**: An algebraic equation where the variable has an exponent of 1 (creates a straight line when graphed).
*   **The Goal**: Isolate the variable (usually $x$) on one side of the equal sign.
*   **The Golden Rule**: Whatever operation you perform on one side of the equation, you *must* perform on the opposite side to keep it balanced.

---

#### Step-by-Step Solving Process
Let's solve the equation:  $$3x + 5 = 17$$

1.  **Isolate the Variable Term (Reverse Addition/Subtraction)**
    *   Identify the constant added or subtracted to the variable term. Here, it is $+5$.
    *   Apply the inverse operation: subtract $5$ from both sides.
    *   $$3x + 5 - 5 = 17 - 5$$
    *   $$3x = 12$$

2.  **Isolate the Variable (Reverse Multiplication/Division)**
    *   Identify the coefficient multiplying the variable. Here, it is $3$ (meaning $3 \times x$).
    *   Apply the inverse operation: divide both sides by $3$.
    *   $$\frac{3x}{3} = \frac{12}{3}$$
    *   $$x = 4$$

3.  **Verify Your Answer**
    *   Plug the result back into the original equation:
    *   $$3(4) + 5 = 12 + 5 = 17$$
    *   The left side matches the right side, confirming the solution is correct!`,
      key_points: [
        "A linear equation's main goal is to isolate the variable (x).",
        "The balance rule requires performing identical operations on both sides.",
        "Inverse operations are used to cancel terms (subtraction cancels addition, division cancels multiplication).",
        "Always clear additions and subtractions before clearing multiplications and divisions.",
        "Answers can be checked by substituting the result back into the original equation."
      ],
      practice_questions: [
        {
          question: "Solve the linear equation: 2x - 7 = 11. What is the value of x?",
          options: ["x = 2", "x = 9", "x = 4", "x = 18"],
          answer: "B",
          explanation: "First, add 7 to both sides: 2x = 18. Then, divide by 2: x = 9."
        },
        {
          question: "What is the inverse operation of multiplying a variable by 5?",
          options: ["Subtracting 5", "Adding 5", "Multiplying by 5", "Dividing by 5"],
          answer: "D",
          explanation: "Division is the inverse operation of multiplication, so dividing by 5 cancels out multiplying by 5."
        },
        {
          question: "If we want to solve 4x + 8 = 24, which step should we do FIRST?",
          options: [
            "Divide both sides by 4",
            "Subtract 8 from both sides",
            "Add 8 to both sides",
            "Multiply both sides by 24"
          ],
          answer: "B",
          explanation: "To isolate the variable term, we should clear constants first by subtracting 8 from both sides."
        }
      ]
    };
  }

  if (text.includes('photosynthesis') || text.includes('chloroplast')) {
    return {
      summary: "This science lecture explains photosynthesis, the process by which plants convert sunlight, water, and carbon dioxide into glucose and oxygen. The lecture details the chloroplast structure, the role of chlorophyll in light absorption, and the two major phases: Light-Dependent Reactions (producing ATP, NADPH, and oxygen in the thylakoid) and the Calvin Cycle (utilizing energy carriers to create glucose in the stroma).",
      structured_notes: `### Biology Lecture: Science of Photosynthesis

#### Overview
*   **Photosynthesis**: The process by which autotrophs (plants, algae) convert light energy into chemical energy (glucose).
*   **Location**: Takes place in the **chloroplast** organelle of plant cells.
*   **Chlorophyll**: Green pigment that absorbs red and blue light and reflects green light, initiating the process.

---

#### Chemical Equation
The chemical reaction is represented as:
$$6CO_2 + 6H_2O + \text{Sunlight} \rightarrow C_6H_{12}O_6 + 6O_2$$

*   **Reactants**: Carbon Dioxide ($CO_2$) and Water ($H_2O$).
*   **Products**: Glucose ($C_6H_{12}O_6$) and Oxygen ($O_2$).

---

#### The Two Main Stages

1.  **Light-Dependent Reactions**
    *   **Location**: Thylakoid membranes inside the chloroplast.
    *   **Process**: Solar energy splits water molecules ($H_2O$), releasing Oxygen ($O_2$) as a waste byproduct.
    *   **Result**: Produces energy molecules **ATP** and **NADPH** to power the next phase.

2.  **Light-Independent Reactions (Calvin Cycle)**
    *   **Location**: Stroma (fluid-filled space inside the chloroplast).
    *   **Process**: Uses carbon dioxide ($CO_2$) along with the energy carriers ATP and NADPH.
    *   **Result**: Synthesizes the organic sugar **Glucose** ($C_6H_{12}O_6$) for plant food.`,
      key_points: [
        "Photosynthesis converts light, carbon dioxide, and water into glucose and oxygen.",
        "Chloroplasts are the cellular organelles where photosynthesis occurs.",
        "Chlorophyll is the green pigment that captures light energy.",
        "Light-Dependent reactions occur in thylakoids and produce ATP, NADPH, and oxygen.",
        "The Calvin Cycle takes place in the stroma and synthesizes glucose using carbon dioxide."
      ],
      practice_questions: [
        {
          question: "Which of the following are the primary reactants of photosynthesis?",
          options: ["Glucose and Oxygen", "Carbon Dioxide and Water", "Carbon Dioxide and Oxygen", "Glucose and Water"],
          answer: "B",
          explanation: "Plants take in Carbon Dioxide and Water as reactants, using light energy to transform them."
        },
        {
          question: "Where do the Light-Dependent Reactions take place within the chloroplast?",
          options: ["Stroma", "Mitochondria", "Thylakoid membranes", "Cell wall"],
          answer: "C",
          explanation: "Light-dependent reactions occur in the thylakoid membranes, which contain chlorophyll."
        },
        {
          question: "What is the primary organic sugar product of photosynthesis?",
          options: ["Fructose", "Sucrose", "Lactose", "Glucose"],
          answer: "D",
          explanation: "Glucose (C6H12O6) is the primary simple sugar produced by plants for energy storage."
        }
      ]
    };
  }

  // General default notes
  return {
    summary: "This lecture outlines the Scientific Method, a systematic inquiry process used by scientists to observe, hypothesize, test, and draw conclusions about natural phenomena. The lecturer explains each phase, noting that controlled experiments are critical to verifying predictions.",
    structured_notes: `### Science Lecture: The Scientific Method

#### Introduction
*   **Scientific Method**: A logical, systematic process of solving problems and making discoveries.
*   **Characteristics**: It is cyclical, empirical, and open to revision based on new data.

---

#### The Core Steps

1.  **Observation & Question**
    *   Notice a pattern or anomaly in the natural world.
    *   Ask a clear, researchable question: 'Why does X affect Y?'

2.  **Hypothesis Formulation**
    *   Draft an educated, proposed answer that is **testable** and **falsifiable**.
    *   Usually written as an 'If-Then' statement.

3.  **Experimentation**
    *   Design a controlled trial to test the hypothesis.
    *   **Variables**:
        *   *Independent Variable*: The factor you change (cause).
        *   *Dependent Variable*: The factor you measure (effect).
        *   *Control Variables*: Factors kept constant to ensure a fair test.

4.  **Data Collection & Analysis**
    *   Gather quantitative (numbers) and qualitative (descriptions) data.
    *   Use graphs and statistics to look for trends.

5.  **Conclusion & Communication**
    *   State whether the data supports or refutes the hypothesis.
    *   Publish results to allow replication by other scientists.`,
    key_points: [
      "The scientific method is a systematic, repeatable process.",
      "A hypothesis must be testable and falsifiable to be scientifically valid.",
      "Controlled experiments change only one independent variable at a time.",
      "Dependent variables are the observed outcomes that depend on independent variables.",
      "If data refutes a hypothesis, a new hypothesis must be developed."
    ],
    practice_questions: [
      {
        question: "What makes a hypothesis scientifically valid?",
        options: [
          "It must be proven correct before testing",
          "It must be testable and falsifiable",
          "It must be accepted by all scientists",
          "It must contain mathematical equations"
        ],
        answer: "B",
        explanation: "A hypothesis must be testable through experiment and capable of being proven false (falsifiable) to be scientific."
      },
      {
        question: "In an experiment testing how fertilizer affects plant growth, what is the independent variable?",
        options: ["The height of the plant", "The amount of water", "The amount of fertilizer", "The temperature of the room"],
        answer: "C",
        explanation: "The independent variable is the factor you manipulate. Here, it is the amount of fertilizer."
      }
    ]
  };
}

function generateMockSlidesContent(studentName, topic) {
  const t = topic.toLowerCase();
  
  if (t.includes('algebra') || t.includes('equation') || t.includes('linear')) {
    return {
      title: "Algebra Made Simple: Linear Equations",
      topic: topic,
      student_name: studentName,
      slides: [
        {
          slide_number: 1,
          title: "What is a Linear Equation?",
          bullets: [
            "A linear equation is a math sentence with an equals sign (=) and a variable.",
            "The variable (like 'x') is a hidden number we want to find.",
            "It is called 'linear' because if we graphed it, it would make a straight line!"
          ],
          analogy: "Think of an equation like a balanced seesaw. Both sides have exactly the same weight. If you add or remove weight from one side, you must do the exact same to the other side to keep it flat!"
        },
        {
          slide_number: 2,
          title: "The Golden Rule: Keeping Balance",
          bullets: [
            "Rule: Whatever you do to one side of the equals sign, you MUST do to the other side.",
            "To solve, we do 'inverse operations' (opposite math actions) to cancel out numbers.",
            "The opposite of addition (+) is subtraction (-).",
            "The opposite of multiplication (x) is division (÷)."
          ],
          analogy: "Like unwrapping a present: you remove the outer layer first, then the inner box, to finally see the gift (the variable x) inside."
        },
        {
          slide_number: 3,
          title: "Systematic Two-Step Method",
          bullets: [
            "Step 1: Clear the constants first. Subtract or add numbers to get the variable term by itself.",
            "Step 2: Clear the coefficients. Divide or multiply to isolate the letter variable.",
            "Always do addition/subtraction before multiplication/division when solving."
          ]
        },
        {
          slide_number: 4,
          title: "Summary of Success",
          bullets: [
            "1. Undo addition/subtraction first.",
            "2. Undo multiplication/division second.",
            "3. Always check your work by putting your answer back into the original equation."
          ]
        }
      ],
      worked_example: {
        problem: "Solve for x: 3x + 8 = 23",
        steps: [
          "Step 1: Get rid of the +8 constant. Subtract 8 from both sides:\n3x + 8 - 8 = 23 - 8\n3x = 15",
          "Step 2: Get rid of the 3 multiplying x. Divide both sides by 3:\n3x / 3 = 15 / 3\nx = 5",
          "Step 3: Check your answer:\n3(5) + 8 = 15 + 8 = 23. It matches!"
        ],
        final_solution: "x = 5"
      },
      extra_practice_questions: [
        {
          question: "Solve the equation: 4x - 5 = 19. What is x?",
          options: ["x = 6", "x = 4", "x = 5", "x = 8"],
          answer: "A",
          explanation: "Add 5 to both sides: 4x = 24. Divide both sides by 4: x = 6."
        },
        {
          question: "If you have the equation x/3 + 4 = 10, which operation should you do FIRST to solve it?",
          options: ["Multiply by 3", "Divide by 3", "Subtract 4", "Add 4"],
          answer: "C",
          explanation: "Always clear the constant first. So, subtract 4 from both sides before multiplying by 3."
        },
        {
          question: "Solve: 5x + 12 = 37. What is x?",
          options: ["x = 3", "x = 5", "x = 7", "x = 2"],
          answer: "B",
          explanation: "Subtract 12: 5x = 25. Divide by 5: x = 5."
        }
      ]
    };
  }
  
  if (t.includes('photosynthesis') || t.includes('plant') || t.includes('chloroplast')) {
    return {
      title: "Photosynthesis: How Plants Make Food",
      topic: topic,
      student_name: studentName,
      slides: [
        {
          slide_number: 1,
          title: "What is Photosynthesis?",
          bullets: [
            "Photosynthesis is how green plants make their own food.",
            "Instead of eating, plants use sunlight, water, and air to build sugar.",
            "This process takes place inside tiny green factories in plant cells called **chloroplasts**."
          ],
          analogy: "Imagine a solar-powered bakery. The sun is the electricity, the carbon dioxide and water are the flour and eggs, and the final cake is glucose!"
        },
        {
          slide_number: 2,
          title: "The Recipe (Chemical Formula)",
          bullets: [
            "Plants absorb Carbon Dioxide (CO2) from the air and Water (H2O) from the soil.",
            "Sunlight energy is captured by a green pigment called **chlorophyll**.",
            "They combine these to produce **Glucose** (plant food) and **Oxygen** (which they release for us to breathe)."
          ],
          analogy: "Recipe: Carbon Dioxide + Water + Sunlight --> Glucose + Oxygen"
        },
        {
          slide_number: 3,
          title: "The Two Bakery Stages",
          bullets: [
            "Stage 1: **Light Reactions** (The Solar Panel). Takes place in thylakoid discs. It traps solar energy and splits water, releasing oxygen.",
            "Stage 2: **Calvin Cycle** (The Mixer). Takes place in the stroma fluid. It uses the trapped energy and carbon dioxide to mix and build Glucose."
          ]
        },
        {
          slide_number: 4,
          title: "Key Takeaways",
          bullets: [
            "Chloroplasts are the kitchens; chlorophyll is the chef absorbing light.",
            "Glucose is the primary product stored for plant energy.",
            "Oxygen is a highly beneficial byproduct released into our atmosphere."
          ]
        }
      ],
      worked_example: {
        problem: "Explain where the carbon atoms in a plant's glucose come from and how they get there.",
        steps: [
          "Step 1: Identify the chemical formula of glucose: C6H12O6. It contains 6 carbon atoms.",
          "Step 2: Look at the inputs of photosynthesis. The only input containing carbon is Carbon Dioxide (CO2).",
          "Step 3: Describe the route. Carbon dioxide is absorbed from the air through tiny leaf pores called stomata, then processed in the stroma during the Calvin Cycle to assemble glucose."
        ],
        final_solution: "The carbon atoms come from carbon dioxide gas in the atmosphere, absorbed through the leaf's stomata."
      },
      extra_practice_questions: [
        {
          question: "Which cell pigment is responsible for absorbing sunlight to power photosynthesis?",
          options: ["Carotene", "Chlorophyll", "Stroma", "Cytoplasm"],
          answer: "B",
          explanation: "Chlorophyll is the green pigment in chloroplasts that absorbs sunlight."
        },
        {
          question: "What gas is released into the atmosphere as a waste product of the light reactions?",
          options: ["Carbon Dioxide", "Nitrogen", "Oxygen", "Water Vapor"],
          answer: "C",
          explanation: "Water is split during the light-dependent reactions, producing oxygen gas which is released."
        },
        {
          question: "Which part of the chloroplast hosts the Calvin Cycle (light-independent reactions)?",
          options: ["Thylakoid Membrane", "Stroma", "Outer Membrane", "Cell Wall"],
          answer: "B",
          explanation: "The Calvin Cycle occurs in the stroma, the fluid-filled region inside the chloroplast."
        }
      ]
    };
  }

  // Default general remedial slides
  return {
    title: "Understanding the Scientific Method",
    topic: topic,
    student_name: studentName,
    slides: [
      {
        slide_number: 1,
        title: "What is the Scientific Method?",
        bullets: [
          "It is a step-by-step recipe scientists use to solve mysteries and answer questions.",
          "Rather than guessing, we use a repeatable, logical cycle.",
          "It helps us gain trustable knowledge that can be verified."
        ],
        analogy: "Like playing detective: you observe a footprint, formulate a theory, check clues, test your theory, and make a final report!"
      },
      {
        slide_number: 2,
        title: "Hypothesis: An Educated guess",
        bullets: [
          "A hypothesis is a clear guess that you can test.",
          "It must be *testable* (you can do a trial) and *falsifiable* (you can prove it wrong).",
          "Usually written as: If I do [change], then [outcome] will happen."
        ]
      },
      {
        slide_number: 3,
        title: "The Experiment: Fair Testing",
        bullets: [
          "To test fairly, we change only ONE variable (Independent Variable).",
          "We measure the outcome (Dependent Variable).",
          "We keep all other conditions exactly the same (Controls) so they don't interfere."
        ]
      }
    ],
    worked_example: {
      problem: "Identify the variables in an experiment testing if studying with music helps test scores.",
      steps: [
        "Step 1: Identify the thing you change. That is whether students listen to music or study in silence. This is the Independent Variable.",
        "Step 2: Identify the thing you measure. That is the score on the test. This is the Dependent Variable.",
        "Step 3: Identify things to keep constant: the study time, the difficulty of the material, and the test itself. These are the Control Variables."
      ],
      final_solution: "Independent: music presence; Dependent: test scores; Controls: study time and test difficulty."
    },
    extra_practice_questions: [
      {
        question: "In a scientific experiment, what is the variable that the scientist purposefully changes?",
        options: ["Dependent Variable", "Independent Variable", "Control Variable", "Hypothesis"],
        answer: "B",
        explanation: "The independent variable is the one manipulated or changed by the experimenter."
      },
      {
        question: "Why do we keep control variables the same during an experiment?",
        options: [
          "To make the experiment finish faster",
          "To make sure our hypothesis is always proven correct",
          "To guarantee that our results are only caused by the independent variable",
          "So we do not have to write down data"
        ],
        answer: "C",
        explanation: "Control variables must be constant so that any change in the dependent variable can be attributed solely to the independent variable."
      }
    ]
  };
}

module.exports = {
  transcribeAudio,
  generateNotes,
  generateRemedialSlides,
  isMockMode
};
