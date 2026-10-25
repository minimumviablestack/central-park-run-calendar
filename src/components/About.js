import React, { useState } from 'react';
import {
  Box,
  Typography,
  Link,
  Button,
  Divider,
  Snackbar,
  Alert
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';
import SavingsOutlinedIcon from '@mui/icons-material/SavingsOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import segmentGeometry from '../data/segmentGeometry.json';

const ETH_ADDRESS = '0xe018D2D302EC79d4Ee3f712d344aA8d221b427EB';
const LOOP_SEGMENTS = ['drive_south', 'drive_east_mid', 'drive_north', 'drive_west_mid'];
const CROSS_SEGMENTS = ['transverse_72', 'transverse_102'];
// Manhattan's grid (and the park) sits ~29° east of true north.
const GRID_ROTATION_DEG = 29;
const LOOP_VIEW = { width: 120, height: 300, pad: 6 };

function projectSegments() {
  const rad = (-GRID_ROTATION_DEG * Math.PI) / 180;
  const cosLat = Math.cos((40.78 * Math.PI) / 180);
  const rotate = ([lat, lng]) => {
    const x = lng * cosLat;
    const y = -lat;
    return [x * Math.cos(rad) - y * Math.sin(rad), x * Math.sin(rad) + y * Math.cos(rad)];
  };

  const ids = [...LOOP_SEGMENTS, ...CROSS_SEGMENTS];
  const rotated = Object.fromEntries(ids.map((id) => [id, segmentGeometry[id].map(rotate)]));
  const all = Object.values(rotated).flat();
  const xs = all.map(([x]) => x);
  const ys = all.map(([, y]) => y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const { width, height, pad } = LOOP_VIEW;
  const scale = Math.min((width - pad * 2) / (maxX - minX), (height - pad * 2) / (maxY - minY));
  const offsetX = (width - (maxX - minX) * scale) / 2;
  const offsetY = (height - (maxY - minY) * scale) / 2;

  const toPath = (points) => points
    .map(([x, y], i) => `${i ? 'L' : 'M'}${((x - minX) * scale + offsetX).toFixed(1)} ${((y - minY) * scale + offsetY).toFixed(1)}`)
    .join(' ');

  return {
    loop: LOOP_SEGMENTS.map((id) => toPath(rotated[id])),
    cross: CROSS_SEGMENTS.map((id) => toPath(rotated[id])),
  };
}

const PARK_PATHS = projectSegments();

function ParkLoop({ sx }) {
  return (
    <Box
      component="svg"
      viewBox={`0 0 ${LOOP_VIEW.width} ${LOOP_VIEW.height}`}
      role="img"
      aria-label="Outline of the Central Park loop"
      sx={(theme) => ({
        display: 'block',
        overflow: 'visible',
        '& path': { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' },
        '& .loop': {
          stroke: theme.palette.primary.main,
          strokeWidth: 3,
          strokeDasharray: 1,
          strokeDashoffset: 0,
          animation: 'drawLoop 2.4s cubic-bezier(.45,0,.2,1) both',
        },
        '& .cross': { stroke: theme.palette.primary.main, strokeWidth: 1.5, opacity: 0.3 },
        '@keyframes drawLoop': { from: { strokeDashoffset: 1 }, to: { strokeDashoffset: 0 } },
        '@media (prefers-reduced-motion: reduce)': { '& .loop': { animation: 'none' } },
        ...sx,
      })}
    >
      {PARK_PATHS.cross.map((d) => <path key={d} className="cross" d={d} />)}
      {PARK_PATHS.loop.map((d) => <path key={d} className="loop" d={d} pathLength="1" />)}
    </Box>
  );
}

function SupportRow({ icon: Icon, children }) {
  return (
    <Box component="li" sx={{ display: 'flex', gap: 2, py: 2, alignItems: 'flex-start' }}>
      <Icon sx={{ color: 'primary.main', mt: '2px', flexShrink: 0 }} aria-hidden="true" />
      <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
    </Box>
  );
}

const bodySx = { fontSize: '1.0625rem', lineHeight: 1.65, maxWidth: '62ch' };

function About() {
  const [notice, setNotice] = useState(null);

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(ETH_ADDRESS);
      setNotice({ severity: 'success', message: 'Address copied' });
    } catch (error) {
      setNotice({ severity: 'error', message: 'Couldn\'t copy. Select the address and copy it manually.' });
    }
  };

  const tipViaMetaMask = async () => {
    if (!window.ethereum) {
      window.open(`https://etherscan.io/address/${ETH_ADDRESS}`, '_blank');
      setNotice({ severity: 'info', message: 'MetaMask not detected. Please install MetaMask to send ETH directly.' });
      return;
    }
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          to: ETH_ADDRESS,
          from: accounts[0],
          value: '0x11c37937e08000', // 0.005 ETH in hex
        }],
      });
    } catch (error) {
      console.error('MetaMask error:', error);
      setNotice({ severity: 'error', message: 'Transaction failed. See console for details.' });
    }
  };

  return (
    <Box component="main" sx={{ maxWidth: 960, mx: 'auto', px: { xs: 2, sm: 4 }, pt: { xs: 2, sm: 3 }, pb: 8 }}>
      <Button
        component={RouterLink}
        to="/"
        startIcon={<ArrowBackIcon />}
        sx={{ textTransform: 'none', ml: -1, mb: { xs: 2, sm: 4 } }}
      >
        Back
      </Button>

      <Box
        component="section"
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 64px', sm: '1fr 140px' },
          columnGap: { xs: 2, sm: 8 },
          alignItems: 'start',
        }}
      >
        <Box sx={{ gridColumn: 1, gridRow: 1 }}>
          <Typography variant="h1" sx={{ fontSize: '1rem', fontWeight: 500, color: 'primary.main', mb: 2 }}>
            About
          </Typography>
          <Typography
            sx={{
              fontSize: { xs: '1.5rem', sm: '2.125rem' },
              fontWeight: 300,
              lineHeight: 1.3,
              letterSpacing: '-0.01em',
              color: 'success.dark',
              maxWidth: '24ch',
              mb: { xs: 3, sm: 4 },
            }}
          >
            Nothing more frustrating than when you are finally well prepared for your weekend long run(or that 5k ultra) just to find out the park is occupied by another event.
          </Typography>
        </Box>
        <Box component="figure" sx={{ m: 0, mt: 1, gridColumn: 2, gridRow: { xs: 1, sm: '1 / span 2' } }}>
          <ParkLoop sx={{ width: '100%', height: 'auto' }} />
          <Typography
            component="figcaption"
            variant="caption"
            sx={{ display: { xs: 'none', sm: 'block' }, mt: 1.5, color: 'text.secondary', textAlign: 'center' }}
          >
            The full loop, 6.03 mi
          </Typography>
        </Box>
        <Box sx={{ gridColumn: { xs: '1 / -1', sm: 1 }, gridRow: 2 }}>
          <Typography sx={{ ...bodySx, mb: 2 }}>
            With <Link component={RouterLink} to="/" color="primary">centralpark.run</Link>, you can easily check for events in the Central Park to avoid running into a race you are not participating...
          </Typography>
          <Typography sx={bodySx}>
            centralpark.run automatically fetch the latest events from various sources weekly and uses generative AI to parse and aggregate events that are happening in the Central Park. So you will know before you go whether you should be running in the park or avoid it that day, or even join the event!
          </Typography>
        </Box>
      </Box>

      <Box component="section" sx={{ mt: { xs: 6, sm: 9 }, maxWidth: '62ch' }}>
        <Typography variant="h2" sx={{ fontSize: '1.5rem', fontWeight: 600, mb: 1.5 }}>
          Support centralpark.run
        </Typography>
        <Typography sx={{ ...bodySx, color: 'text.secondary', mb: 1 }}>
          Even though this is pretty bare bones, it costs me some $ to build it, like domain name, GenAI API costs.
          If you find this tool helpful for your running routine, please consider supporting it:
        </Typography>

        <Box
          component="ul"
          sx={{
            listStyle: 'none',
            p: 0,
            m: 0,
            '& > li + li': { borderTop: 1, borderColor: 'divider' },
            '& a': { fontSize: '1.0625rem' },
          }}
        >
          <SupportRow icon={StarBorderIcon}>
            <Link href="https://github.com/minimumviablestack/central-park-run-calendar" target="_blank" rel="noopener">
              Star the project on GitHub
            </Link>
          </SupportRow>
          <SupportRow icon={ChatBubbleOutlineIcon}>
            <Link href="https://github.com/minimumviablestack/central-park-run-calendar/issues" target="_blank" rel="noopener">
              Submit feedback or feature requests, help me build this better.
            </Link>
          </SupportRow>
          <SupportRow icon={GroupsOutlinedIcon}>
            <Typography sx={{ fontSize: '1.0625rem' }}>Share with fellow runners in your community</Typography>
          </SupportRow>
          <SupportRow icon={ShoppingBagOutlinedIcon}>
            <Typography sx={{ fontSize: '1.0625rem', lineHeight: 1.55, mb: 0.75 }}>
              If you are interested in buying running gears, use my referral links(so I can spend even more on running gears XD):
            </Typography>
            <Link href="https://r.infl.co/wnd0R76UIi5" target="_blank" rel="noopener" color="primary">
              Soar running referral
            </Link>
          </SupportRow>
          <SupportRow icon={SavingsOutlinedIcon}>
            <Typography sx={{ fontSize: '1.0625rem', mb: 1 }}>Crypto(ETH or ERC-20) tip jar:</Typography>
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <Typography
                component="code"
                sx={{
                  fontFamily: 'inherit',
                  fontSize: '0.875rem',
                  color: 'success.dark',
                  bgcolor: 'success.light',
                  borderRadius: 1,
                  px: 1.25,
                  py: 0.75,
                  wordBreak: 'break-all',
                  flex: '1 1 260px',
                }}
              >
                {ETH_ADDRESS}
              </Typography>
              <Button size="small" startIcon={<ContentCopyIcon />} onClick={copyAddress} sx={{ textTransform: 'none' }}>
                Copy
              </Button>
              <Button size="small" variant="outlined" onClick={tipViaMetaMask} sx={{ textTransform: 'none' }}>
                Tip via MetaMask
              </Button>
            </Box>
          </SupportRow>
        </Box>
      </Box>

      <Typography sx={{ mt: { xs: 6, sm: 8 }, fontSize: '1.125rem', fontWeight: 500, color: 'primary.main' }}>
        Created by a runner, for all runners. Happy running!
      </Typography>

      <Divider sx={{ mt: 4, mb: 3 }} />

      <Box component="section" sx={{ maxWidth: '72ch' }}>
        <Typography variant="h2" sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'text.secondary', mb: 0.5 }}>
          Disclaimer
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
          centralpark.run is not affiliated with, endorsed by, or in any way officially connected (except I love them) with Central Park, New York Road Runners (NYRR), dressmyrun.com, or any of the other data sources used on this website. All event information is aggregated from publicly available sources for informational purposes only.
        </Typography>
      </Box>

      <Snackbar
        open={Boolean(notice)}
        autoHideDuration={4000}
        onClose={() => setNotice(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {notice ? <Alert severity={notice.severity} onClose={() => setNotice(null)}>{notice.message}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}

export default About;
