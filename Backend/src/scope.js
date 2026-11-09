/**
 * Site and plant that the logsheet load code writes to.
 *
 * One run loads one plant. To load another plant, set PID_SITE_ID and PID_PLANT_ID
 * for that run, using the ids from the plants table (Master, Plant).
 */
export const SITE_ID = process.env.PID_SITE_ID || 'bekasi'
export const PLANT_ID = process.env.PID_PLANT_ID || 'prc-palm-lauric-bekasi'
