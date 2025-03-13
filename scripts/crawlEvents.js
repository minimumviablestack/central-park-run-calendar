const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
require('dotenv').config();
const puppeteer = require('puppeteer');

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// URLs to crawl - replace with your target websites
const urlsToScrape = [
  'https://www.nycgovparks.org/parks/central-park/events',
  'https://www.nyrr.org/fullraceyearindex'
  // Add more URLs as needed
];

// Output file path
const outputPath = path.join(__dirname, '../data/events.csv');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, '../data'))) {
  fs.mkdirSync(path.join(__dirname, '../data'));
}

// CSV writer setup
const csvWriter = createCsvWriter({
  path: outputPath,
  header: [
    { id: 'name', title: 'EVENT_NAME' },
    { id: 'date', title: 'DATE' },
    { id: 'startTime', title: 'START_TIME' },
    { id: 'endTime', title: 'END_TIME' },
    { id: 'location', title: 'LOCATION' },
    { id: 'description', title: 'DESCRIPTION' },
    { id: 'url', title: 'URL' }
  ]
});

async function fetchPageContent(url) {
  try {
    // For NYRR website, use Puppeteer
    if (url.includes('nyrr.org')) {
      const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: 'new'
      });
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36');
      await page.goto(url, { waitUntil: 'networkidle2' });
      const content = await page.content();
      await browser.close();
      return content;
    } else {
      // For other sites, use the existing axios method
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
        }
      });
      return response.data;
    }
  } catch (error) {
    console.error(`Error fetching ${url}:`, error.message);
    return null;
  }
}

async function extractEventsWithLLM(htmlContent, sourceUrl) {
  try {
    // Load the HTML content with Cheerio to extract text
    const $ = cheerio.load(htmlContent);
    
    // Remove script and style elements
    $('script, style').remove();
    
    // Get text content
    const textContent = $('body').text().replace(/\s+/g, ' ').trim().substring(0, 15000);
    
    // Call OpenAI API to extract events
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system", 
          content: "You are an expert at extracting structured event data from text. Extract all events mentioned in the text and format them as JSON. Pay special attention to race events, dates, times, and locations."
        },
        {
          role: "user",
          content: `Extract all running events and races from this text from ${sourceUrl}. Focus on event name, date, time, and location. Return ONLY a JSON array with objects containing these fields: name, date (YYYY-MM-DD format), startTime, endTime, location, description, category (if available). For NYRR races, look for race calendar entries, upcoming events, and scheduled runs. For NYC Parks events, include the category field. Here's the text: ${textContent}`
        }
      ],
      temperature: 0.2,
    });

    // Parse the response
    const responseText = completion.choices[0].message.content;
    try {
      // Extract JSON from the response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const events = JSON.parse(jsonMatch[0]);
        // Add source URL to each event
        return events.map(event => ({...event, url: sourceUrl}));
      } else {
        console.error("No JSON found in response");
        return [];
      }
    } catch (parseError) {
      console.error("Error parsing JSON from LLM response:", parseError);
      console.log("Raw response:", responseText);
      return [];
    }
  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    return [];
  }
}

// Function to filter events based on location and category
function filterEvents(events, sourceUrl) {
  return events.filter(event => {
    // Check if location contains "Central Park" (case insensitive)
    const locationMatch = event.location && 
      event.location.toLowerCase().includes('central park');
    
    // For NYC Parks events, check if category includes "Running"
    const categoryMatch = sourceUrl.includes('nycgovparks.org') ? 
      (event.category && event.category.toLowerCase().includes('running')) : 
      true; // For non-NYC Parks events, don't filter by category
    
    return locationMatch && categoryMatch;
  });
}

// Function to deduplicate events
function deduplicateEvents(events) {
  const uniqueEvents = new Map();
  
  events.forEach(event => {
    // Create a unique key using event name and date
    const key = `${event.name.toLowerCase().trim()}_${event.date}`;
    
    // Only add if this key doesn't exist yet, or replace if the existing event has less information
    if (!uniqueEvents.has(key) || 
        (uniqueEvents.get(key).description || '').length < (event.description || '').length) {
      uniqueEvents.set(key, event);
    }
  });
  
  return Array.from(uniqueEvents.values());
}

async function main() {
  let allEvents = [];
  
  // Process each URL
  for (const url of urlsToScrape) {
    console.log(`Crawling ${url}...`);
    const htmlContent = await fetchPageContent(url);
    
    if (htmlContent) {
      console.log(`Extracting events from ${url}...`);
      let events = await extractEventsWithLLM(htmlContent, url);
      console.log(`Found ${events.length} events from ${url}`);
      
      // Filter events by location and category
      const filteredEvents = filterEvents(events, url);
      console.log(`Filtered to ${filteredEvents.length} Central Park running events`);
      
      allEvents = [...allEvents, ...filteredEvents];
    }
  }
  
  // Deduplicate events
  const uniqueEvents = deduplicateEvents(allEvents);
  console.log(`After deduplication: ${uniqueEvents.length} unique events`);
  
  // Write to CSV
  if (uniqueEvents.length > 0) {
    await csvWriter.writeRecords(uniqueEvents);
    
    // Remove trailing newline if it exists
    const fileContent = fs.readFileSync(outputPath, 'utf8');
    if (fileContent.endsWith('\n')) {
      fs.writeFileSync(outputPath, fileContent.trimEnd());
    }
    
    console.log(`Successfully wrote ${uniqueEvents.length} events to ${outputPath}`);
  } else {
    console.log("No events found to write to CSV");
  }
}

main().catch(console.error);