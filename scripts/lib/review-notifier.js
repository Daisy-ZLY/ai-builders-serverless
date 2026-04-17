import { formatReviewSummary } from './review-summary.js';

export async function notifyReviewReady({
  reviewState,
  channel = 'none',
  write = text => process.stdout.write(text)
}) {
  const summary = formatReviewSummary(reviewState);

  if (channel === 'none') {
    return {
      channel,
      notified: false,
      summary
    };
  }

  if (channel === 'stdout' || channel === 'local') {
    write(`${summary}\n`);
    return {
      channel,
      notified: true,
      summary
    };
  }

  return {
    channel,
    notified: false,
    summary
  };
}

export async function notifyPublished({
  date,
  channel = 'none',
  write = text => process.stdout.write(text)
}) {
  const message = `Published digest: ${date}`;

  if (channel === 'stdout' || channel === 'local') {
    write(`${message}\n`);
    return { channel, notified: true, message };
  }

  return { channel, notified: false, message };
}
