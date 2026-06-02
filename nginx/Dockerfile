# ===================================================================
# AI-Sourcing Hub — Nginx Reverse Proxy
# ===================================================================
# Serves as the entry point for all HTTP/S traffic.
# Handles SSL termination, static file serving, and reverse proxy
# to the FastAPI application.
# ===================================================================

FROM nginx:1.27-alpine

# Remove default nginx config
RUN rm -f /etc/nginx/conf.d/default.conf

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose HTTP and HTTPS ports
EXPOSE 80
EXPOSE 443

CMD ["nginx", "-g", "daemon off;"]
