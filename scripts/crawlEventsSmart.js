const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
require('dotenv').config();
const puppeteer = require('puppeteer');

const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

const urlsToScrape = [
  'https://www.nycgovparks.org/parks/central-park/events',
  'https://www.nyrr.org/run/race-calendar',
  'https://nycruns.com/races'
];

const NYC_OPEN_DATA_API = 'https://data.cityofnewyork.us/resource/8end-qv57.json';

const outputPath = path.join(__dirname, '../data/events.csv');

if (!fs.existsSync(path.join(__dirname, '../data'))) {
  fs.mkdirSync(path.join(__dirname, '../data'));
}

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

function normalizeDate(dateStr) {
  if (!dateStr) return '';
  
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  const months = {
    'january': '01', 'february': '02', 'march': '03', 'april': '04',
    'may': '05', 'june': '06', 'july': '07', 'august': '08',
    'september': '09', 'october': '10', 'november': '11', 'december': '12'
  };
  
  const match = dateStr.match(/(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:,?\s*(\d{4}))?/i);
  if (!match) return dateStr;
  
  const monthName = match[1].toLowerCase();
  const day = match[2].padStart(2, '0');
  let year = match[3];
  
  const monthNum = months[monthName];
  if (!monthNum) return dateStr;
  
  if (!year) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const eventMonth = parseInt(monthNum, 10);
    
    if (eventMonth < currentMonth) {
      year = String(currentYear + 1);
    } else if (eventMonth === currentMonth) {
      const eventDay = parseInt(day, 10);
      year = eventDay < now.getDate() ? String(currentYear + 1) : String(currentYear);
    } else {
      year = String(currentYear);
    }
  }
  
  return `${year}-${monthNum}-${day}`;
}

async function readExistingEvents() {
  return new Promise((resolve, reject) => {
    const events = [];
    
    if (!fs.existsSync(outputPath)) {
      return resolve([]);
    }
    
    fs.createReadStream(outputPath)
      .pipe(csv())
      .on('data', (data) => {
        const event = {
          name: data.EVENT_NAME,
          date: normalizeDate(data.DATE),
          startTime: data.START_TIME,
          endTime: data.END_TIME,
          location: data.LOCATION,
          description: data.DESCRIPTION,
          url: data.URL
        };
        events.push(event);
      })
      .on('end', () => {
        console.log(`Loaded ${events.length} existing events from CSV`);
        resolve(events);
      })
      .on('error', (error) => {
        console.error('Error reading existing events:', error);
        resolve([]);
      });
  });
}

function deduplicateEvents(events) {
  const uniqueEvents = new Map();
  
  events.forEach(event => {
    const key = `${event.name.toLowerCase().trim()}_${event.date}`;
    
    if (!uniqueEvents.has(key) || 
        (uniqueEvents.get(key).description || '').length < (event.description || '').length) {
      uniqueEvents.set(key, event);
    }
  });
  
  return Array.from(uniqueEvents.values());
}

async function fetchNYCOpenDataEvents() {
  console.log('Fetching events from NYC Open Data API...');
  
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const params = {
      $where: `event_location LIKE '%Central Park%' AND start_date_time >= '${today}T00:00:00'`,
      $order: 'start_date_time ASC',
      $limit: 500
    };
    
    const response = await axios.get(NYC_OPEN_DATA_API, { params });
    
    const allEvents = response.data;
    console.log(`Found ${allEvents.length} total events from NYC Open Data API`);
    
    const runningKeywords = ['run', 'race', 'marathon', 'triathlon', '5k', '10k', 'half'];
    const largeEventKeywords = ['concert', 'festival', 'rally', 'parade'];
    
    const filteredEvents = allEvents.filter(event => {
      const name = (event.event_name || '').toLowerCase();
      const type = (event.event_type || '').toLowerCase();
      const location = (event.event_location || '').toLowerCase();
      
      if (location.includes('lawn') || location.includes('playground')) {
        return false;
      }
      
      const isRunning = runningKeywords.some(kw => name.includes(kw) || type.includes(kw));
      const isLargeEvent = largeEventKeywords.some(kw => name.includes(kw) || type.includes(kw));
      
      return isRunning || isLargeEvent;
    });
    
    console.log(`Filtered to ${filteredEvents.length} running/large events`);
    
    return filteredEvents.map(event => {
      const startDate = new Date(event.start_date_time);
      const endDate = event.end_date_time ? new Date(event.end_date_time) : null;
      
      return {
        name: event.event_name || 'Unnamed Event',
        date: startDate.toISOString().split('T')[0],
        startTime: startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
        endTime: endDate ? endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '',
        location: event.event_location || 'Central Park',
        description: `${event.event_type || 'Event'} - ${event.event_agency || 'NYC Parks'}`,
        url: `https://www.nycgovparks.org/parks/central-park/events`
      };
    });
  } catch (error) {
    console.error('Error fetching from NYC Open Data API:', error.message);
    return [];
  }
}

async function fetchNYCParksEventsStructured() {
  console.log('Fetching events from NYC Parks website (structured parsing with pagination)...');
  
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: 'new'
  });
  
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36');
    
    const allEvents = [];
    const baseUrl = 'https://www.nycgovparks.org/parks/central-park/events';
    
    let currentPage = 1;
    const maxPages = 3;
    
    while (currentPage <= maxPages) {
      const pageUrl = currentPage === 1 ? baseUrl : `${baseUrl}/page/${currentPage}`;
      console.log(`  Fetching page ${currentPage}: ${pageUrl}`);
      
      await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      
      const pageEvents = await page.evaluate(() => {
        const events = [];
        const eventElements = document.querySelectorAll('.vevent');
        
        eventElements.forEach(el => {
          const summaryEl = el.querySelector('.summary');
          const titleLink = summaryEl?.querySelector('a');
          const title = titleLink?.textContent?.trim() || summaryEl?.textContent?.trim() || '';
          const eventUrl = titleLink?.getAttribute('href') || '';
          
          const dtstart = el.querySelector('.dtstart');
          const dtend = el.querySelector('.dtend');
          const startDateTime = dtstart?.getAttribute('title') || '';
          const endDateTime = dtend?.getAttribute('title') || '';
          
          const locationEl = el.querySelector('.location');
          const location = locationEl?.textContent?.trim() || '';
          
          const fullText = el.textContent || '';
          const categoryMatch = fullText.match(/Category:\s*([^\n]+)/);
          const category = categoryMatch ? categoryMatch[1].trim() : '';
          
          const isFree = fullText.includes('Free!');
          
          if (title) {
            events.push({
              title,
              eventUrl: eventUrl.startsWith('/') ? `https://www.nycgovparks.org${eventUrl}` : eventUrl,
              startDateTime,
              endDateTime,
              location,
              category,
              isFree
            });
          }
        });
        
        return events;
      });
      
      console.log(`    Found ${pageEvents.length} events on page ${currentPage}`);
      allEvents.push(...pageEvents);
      
      const hasNextPage = await page.evaluate(() => {
        const links = document.querySelectorAll('.parks_pages a');
        for (const link of links) {
          if (link.textContent.includes('Next')) {
            return true;
          }
        }
        return false;
      });
      
      if (!hasNextPage || pageEvents.length === 0) {
        break;
      }
      
      currentPage++;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    await browser.close();
    
    return allEvents.map(event => {
      let date = '';
      let startTime = '';
      let endTime = '';
      
      if (event.startDateTime) {
        const startDate = new Date(event.startDateTime);
        date = startDate.toISOString().split('T')[0];
        startTime = startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      }
      
      if (event.endDateTime) {
        const endDate = new Date(event.endDateTime);
        endTime = endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      }
      
      const isRunning = event.category?.toLowerCase().includes('running') ||
                        event.title?.toLowerCase().includes('run') ||
                        event.title?.toLowerCase().includes('race') ||
                        event.title?.toLowerCase().includes('marathon');
      
      return {
        name: event.title,
        date,
        startTime,
        endTime,
        location: event.location || 'Central Park',
        description: event.category || (event.isFree ? 'Free Event' : 'Event'),
        url: event.eventUrl || 'https://www.nycgovparks.org/parks/central-park/events',
        isRunning
      };
    });
    
  } catch (error) {
    console.error('Error fetching NYC Parks events:', error.message);
    await browser.close();
    return [];
  }
}

function parseNYRRDate(dateStr) {
  if (!dateStr) return '';
  
  const months = {
    'january': '01', 'february': '02', 'march': '03', 'april': '04',
    'may': '05', 'june': '06', 'july': '07', 'august': '08',
    'september': '09', 'october': '10', 'november': '11', 'december': '12'
  };
  
  const match = dateStr.match(/(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:,?\s*(\d{4}))?/i);
  if (!match) return '';
  
  const monthName = match[1].toLowerCase();
  const day = match[2].padStart(2, '0');
  let year = match[3];
  
  const monthNum = months[monthName];
  if (!monthNum) return '';
  
  if (!year) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const eventMonth = parseInt(monthNum, 10);
    
    if (eventMonth < currentMonth) {
      year = String(currentYear + 1);
    } else if (eventMonth === currentMonth) {
      const eventDay = parseInt(day, 10);
      year = eventDay < now.getDate() ? String(currentYear + 1) : String(currentYear);
    } else {
      year = String(currentYear);
    }
  }
  
  return `${year}-${monthNum}-${day}`;
}

async function fetchNYRREventsWithDetailPages() {
  console.log('Fetching NYRR events from race calendar...');
  
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: 'new'
  });
  
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36');
    
    await page.goto('https://www.nyrr.org/run/race-calendar', { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));
    
    const events = await page.evaluate(() => {
      const results = [];
      const monthAbbrevToNum = {
        'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04',
        'MAY': '05', 'JUN': '06', 'JUL': '07', 'AUG': '08',
        'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12'
      };
      
      const raceCards = document.querySelectorAll('.upcoming-event, .upcoming-race');
      
      raceCards.forEach(card => {
        const text = card.innerText || '';
        const lowerText = text.toLowerCase();
        
        const mentionsCentralPark = lowerText.includes('central park');
        const isNewYorkLocation = lowerText.includes('new york') && !lowerText.includes('brooklyn') && !lowerText.includes('queens') && !lowerText.includes('bronx') && !lowerText.includes('staten island');
        const isVirtual = lowerText.includes('virtual');
        const isRoadRace = lowerText.includes('4 miles') || lowerText.includes('4m') || lowerText.includes('5k') || lowerText.includes('10k') || lowerText.includes('half marathon') || lowerText.includes('marathon');
        
        const isCentralParkRace = mentionsCentralPark || (isNewYorkLocation && isRoadRace && !isVirtual);
        if (!isCentralParkRace) return;
        
        const dateEl = card.querySelector('.upcoming-race-date, [class*="date"]');
        const dateText = dateEl ? dateEl.innerText.trim() : '';
        
        const dayMatch = dateText.match(/(\d{1,2})/);
        const monthMatch = dateText.match(/(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)/i);
        
        let dateStr = '';
        if (dayMatch && monthMatch) {
          const day = dayMatch[1].padStart(2, '0');
          const monthNum = monthAbbrevToNum[monthMatch[1].toUpperCase()];
          if (monthNum) {
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth() + 1;
            const eventMonth = parseInt(monthNum, 10);
            const year = eventMonth < currentMonth ? currentYear + 1 : currentYear;
            dateStr = `${year}-${monthNum}-${day}`;
          }
        }
        
        const nameEl = card.querySelector('.upcoming-race-title, h3, h4, [class*="title"]');
        let name = '';
        if (nameEl) {
          name = nameEl.innerText.trim();
        } else {
          const lines = text.split('\n').filter(l => l.trim().length > 5);
          for (const line of lines) {
            if (line.match(/\d{1,2}/) && line.match(/(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)/i)) continue;
            if (line.match(/^\d{1,2}:\d{2}/)) continue;
            if (line.toLowerCase().includes('new york')) continue;
            if (line.match(/^\$\d+/)) continue;
            if (line.toLowerCase().includes('learn more')) continue;
            if (line.match(/^(half marathon|10k|5k|4 miles|\d+ miles?)$/i)) continue;
            name = line.trim();
            break;
          }
        }
        
        const timeMatch = text.match(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
        const startTime = timeMatch ? timeMatch[1].trim() : '';
        
        const linkEl = card.querySelector('a[href*="/run/"], a[href*="events.nyrr.org"]');
        let url = 'https://www.nyrr.org/run/race-calendar';
        if (linkEl) {
          const href = linkEl.getAttribute('href');
          url = href.startsWith('http') ? href : `https://www.nyrr.org${href}`;
        }
        
        if (name && dateStr && name.length > 5) {
          const key = name.toLowerCase().replace(/[^a-z0-9]/g, '');
          const isDuplicate = results.find(r => r.name.toLowerCase().replace(/[^a-z0-9]/g, '') === key);
          if (!isDuplicate) {
            results.push({ name, dateStr, startTime, url });
          }
        }
      });
      
      return results;
    });
    
    await browser.close();
    
    const centralParkEvents = events.map(e => ({
      name: e.name,
      date: e.dateStr,
      startTime: e.startTime,
      endTime: '',
      location: 'Central Park, New York',
      description: 'NYRR Race',
      url: e.url
    }));
    
    console.log(`Found ${centralParkEvents.length} Central Park events from NYRR`);
    return centralParkEvents;
    
  } catch (error) {
    console.error('Error fetching NYRR events:', error.message);
    await browser.close();
    return [];
  }
}

async function fetchPageContent(url) {
  try {
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
  } catch (error) {
    console.error(`Error fetching ${url}:`, error.message);
    return null;
  }
}

async function extractEventsWithLLM(htmlContent, sourceUrl) {
  if (!openai) {
    console.log('OpenAI API key not configured, skipping LLM extraction for', sourceUrl);
    return [];
  }
  
  try {
    const $ = cheerio.load(htmlContent);
    $('script, style').remove();
    const textContent = $('body').text().replace(/\s+/g, ' ').trim().substring(0, 15000);
    
    let learnMoreInfo = '';
    if (sourceUrl.includes('nyrr.org')) {
      const learnMoreLinks = [];
      $('a').each((i, elem) => {
        const href = $(elem).attr('href');
        const text = $(elem).text().trim().toLowerCase();
        if ((text.includes('learn more') || text.includes('details')) && href) {
          const fullUrl = href.startsWith('http') ? href : 
                         href.startsWith('/') ? `https://www.nyrr.org${href}` : 
                         `https://www.nyrr.org/${href}`;
          learnMoreLinks.push(fullUrl);
        }
      });
      
      const limitedLinks = learnMoreLinks.slice(0, 3);
      
      for (const link of limitedLinks) {
        try {
          console.log(`Fetching additional info from: ${link}`);
          const browser = await puppeteer.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            headless: 'new'
          });
          const page = await browser.newPage();
          await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36');
          await page.goto(link, { waitUntil: 'networkidle2', timeout: 30000 });
          const linkContent = await page.content();
          await browser.close();
          
          const $link = cheerio.load(linkContent);
          $link('script, style').remove();
          const linkText = $link('body').text().replace(/\s+/g, ' ').trim().substring(0, 5000);
          
          learnMoreInfo += `\n\nAdditional information from ${link}:\n${linkText}`;
        } catch (linkError) {
          console.error(`Error fetching additional info from ${link}:`, linkError.message);
        }
      }
    }
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system", 
          content: "You are an expert at extracting structured event data from text. Extract all events mentioned in the text and format them as JSON. Pay special attention to race events, dates, times, and locations. For NYRR events, make sure to look for location information in the additional details sections."
        },
        {
          role: "user",
          content: `Extract all running events and races from this text from ${sourceUrl}. Focus on event name, date, time, and location. Return ONLY a JSON array with objects containing these fields: name, date (YYYY-MM-DD format), startTime, endTime, location, description, category (if available), eventUrl (direct link to the event if available). 
          For NYRR races, look for race calendar entries, upcoming events, and scheduled runs. Pay special attention to location information which may be in the additional details sections.
          For NYC Parks events, include the category field. 
          For NYCRUNS races, use RACE START time as event start time.
          Here's the text: ${textContent}${learnMoreInfo}`
        }
      ],
      temperature: 0.2,
      max_tokens: 8000,
    });

    const responseText = completion.choices[0].message.content;
    console.log("Raw LLM response:", responseText);
    
    try {
      try {
        const events = JSON.parse(responseText);
        if (Array.isArray(events)) {
          console.log("Successfully parsed entire response as JSON array");
          return events.map(event => ({
            ...event, 
            url: event.eventUrl || sourceUrl
          }));
        }
      } catch (directParseError) {
        console.log("Response is not a direct JSON array, trying to extract JSON...");
      }
      
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        console.log("Found JSON array in response using regex");
        const events = JSON.parse(jsonMatch[0]);
        return events.map(event => ({
          ...event, 
          url: event.eventUrl || sourceUrl
        }));
      } else {
        console.error("No JSON array found in response, trying alternative parsing");
        
        const objectMatches = responseText.match(/\{[^{}]*\}/g);
        if (objectMatches && objectMatches.length > 0) {
          console.log(`Found ${objectMatches.length} potential JSON objects`);
          
          const events = [];
          for (const match of objectMatches) {
            try {
              const event = JSON.parse(match);
              events.push(event);
            } catch (objParseError) {
              console.log(`Failed to parse object: ${match}`);
            }
          }
          
          if (events.length > 0) {
            console.log(`Successfully parsed ${events.length} events from response`);
            return events.map(event => ({
              ...event, 
              url: event.eventUrl || sourceUrl
            }));
          }
        }
        
        console.error("No valid JSON found in response");
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

function filterEvents(events, sourceUrl) {
  return events.filter(event => {
    const location = (event.location || '').toLowerCase();
    const name = (event.name || '').toLowerCase();
    
    const centralParkKeywords = ['central park', 'manhattan', 'new york'];
    const locationMatch = centralParkKeywords.some(kw => location.includes(kw));
    
    const runningKeywords = ['run', 'race', 'marathon', '5k', '10k', 'half', 'mile', 'walk'];
    const isCentralParkRace = runningKeywords.some(kw => name.includes(kw)) && 
                              (location.includes('central park') || name.includes('central park'));
    
    if (sourceUrl.includes('nyrr.org')) {
      return isCentralParkRace;
    }
    
    if (sourceUrl.includes('nycruns.com')) {
      return location.includes('central park');
    }
    
    return locationMatch;
  });
}

async function main() {
  console.log('='.repeat(60));
  console.log('Central Park Run Calendar - Smart Event Crawler');
  console.log('='.repeat(60));
  
  const existingEvents = await readExistingEvents();
  console.log(`Found ${existingEvents.length} existing events in the CSV file`);
  
  let allEvents = [];
  
  console.log('\n--- NYC Open Data API ---');
  console.log('Skipping - API mostly contains lawn closures, not running events');
  const openDataEvents = [];
  console.log(`Got ${openDataEvents.length} events from NYC Open Data API`);
  allEvents = [...allEvents, ...openDataEvents];
  
  console.log('\n--- NYC Parks Website (Structured Parsing) ---');
  const nycParksEvents = await fetchNYCParksEventsStructured();
  
  const runningKeywords = ['run', 'race', 'marathon', 'triathlon', '5k', '10k', 'half'];
  const largeEventKeywords = ['concert', 'festival', 'rally', 'parade'];
  
  const filteredParksEvents = nycParksEvents.filter(event => {
    const name = (event.name || '').toLowerCase();
    const desc = (event.description || '').toLowerCase();
    const location = (event.location || '').toLowerCase();
    
    if (location.includes('lawn') || location.includes('playground') || name.includes('lawn closure')) {
      return false;
    }
    
    if (name.includes('walk') && !name.includes('run')) {
      return false;
    }
    
    const isRunning = runningKeywords.some(kw => name.includes(kw) || desc.includes(kw));
    const isLargeEvent = largeEventKeywords.some(kw => name.includes(kw) || desc.includes(kw));
    
    return isRunning || isLargeEvent;
  });
  
  console.log(`Got ${filteredParksEvents.length} relevant events from NYC Parks (filtered from ${nycParksEvents.length} total)`);
  allEvents = [...allEvents, ...filteredParksEvents];
  
  console.log('\n--- NYRR (Detail Page Scraping) ---');
  const nyrrEvents = await fetchNYRREventsWithDetailPages();
  console.log(`Got ${nyrrEvents.length} Central Park events from NYRR`);
  allEvents = [...allEvents, ...nyrrEvents];
  
  console.log('\n--- NYCRUNS (LLM Extraction) ---');
  const nycrunsUrl = 'https://nycruns.com/races';
  console.log(`Crawling ${nycrunsUrl}...`);
  const htmlContent = await fetchPageContent(nycrunsUrl);
  
  if (htmlContent) {
    console.log(`Extracting events from ${nycrunsUrl}...`);
    let events = await extractEventsWithLLM(htmlContent, nycrunsUrl);
    console.log(`Found ${events.length} events from ${nycrunsUrl}`);
    
    const filteredEvents = filterEvents(events, nycrunsUrl);
    console.log(`Filtered to ${filteredEvents.length} Central Park running events`);
    
    allEvents = [...allEvents, ...filteredEvents];
  }
  
  allEvents = [...existingEvents, ...allEvents];
  console.log(`\nTotal events after merging: ${allEvents.length}`);
  
  const uniqueEvents = deduplicateEvents(allEvents);
  console.log(`After deduplication: ${uniqueEvents.length} unique events`);
  
  uniqueEvents.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  if (uniqueEvents.length > 0) {
    await csvWriter.writeRecords(uniqueEvents);
    
    const fileContent = fs.readFileSync(outputPath, 'utf8');
    if (fileContent.endsWith('\n')) {
      fs.writeFileSync(outputPath, fileContent.trimEnd());
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Successfully wrote ${uniqueEvents.length} events to ${outputPath}`);
    
    const publicDataDir = path.join(__dirname, '../public/data');
    if (!fs.existsSync(publicDataDir)) {
      fs.mkdirSync(publicDataDir, { recursive: true });
    }
    const publicDataPath = path.join(publicDataDir, 'events.csv');
    fs.copyFileSync(outputPath, publicDataPath);
    console.log(`Copied to ${publicDataPath} for local development`);
    
    console.log('='.repeat(60));
  } else {
    console.log("No events found to write to CSV");
  }
}

main().catch(console.error);
