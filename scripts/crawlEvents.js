const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
require('dotenv').config();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// URLs to crawl - replace with your target websites
const urlsToScrape = [
  'https://www.centralparknyc.org/events',
  'https://www.nycgovparks.org/events/central-park'
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
    const response = await axios.get(url);
    return response.data;
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
          content: "You are an expert at extracting structured event data from text. Extract all events mentioned in the text and format them as JSON."
        },
        {
          role: "user",
          content: `Extract all events from this text from ${sourceUrl}. Return ONLY a JSON array with objects containing these fields: name, date (YYYY-MM-DD format), startTime, endTime, location, description. Here's the text: ${textContent}`
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

async function main() {
  let allEvents = [];
  
  // Process each URL
  for (const url of urlsToScrape) {
    console.log(`Crawling ${url}...`);
    const htmlContent = await fetchPageContent(url);
    
    if (htmlContent) {
      console.log(`Extracting events from ${url}...`);
      const events = await extractEventsWithLLM(htmlContent, url);
      console.log(`Found ${events.length} events from ${url}`);
      allEvents = [...allEvents, ...events];
    }
  }
  
  // Write to CSV
  if (allEvents.length > 0) {
    await csvWriter.writeRecords(allEvents);
    console.log(`Successfully wrote ${allEvents.length} events to ${outputPath}`);
  } else {
    console.log("No events found to write to CSV");
  }
}

main().catch(console.error);