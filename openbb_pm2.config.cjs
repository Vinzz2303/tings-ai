module.exports = {
  apps: [
    {
      name: 'openbb-api',
      script: 'C:\\apps\\portofolio\\openbb_env\\Scripts\\uvicorn.exe',
      args: 'openbb_core.api.rest_api:app --host 127.0.0.1 --port 6900',
      interpreter: 'none',
      cwd: 'C:\\apps\\portofolio',
      env: {
        PYTHONPATH: 'C:\\apps\\portofolio'
      }
    }
  ]
};
