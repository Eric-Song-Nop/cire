/**
 * Simple logging utility based on loglevel.
 * Provides unified logging interface for the Cire CLI tool.
 */
import log from "loglevel";

/**
 * Set default log level to error to avoid excessive output.
 * Can be overridden by configuration.
 */
log.setLevel("error");

/**
 * Global singleton logger instance.
 * All modules should use this instance for consistent logging.
 */
export const logger = log.noConflict();
