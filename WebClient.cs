using Microsoft.AspNetCore.StaticFiles;
using System.Diagnostics;
using System.Reflection;
using System.Text;

namespace Brayns.Shaper
{
    public static class WebClient
    {
        private static byte[]? _minClient;

        internal static string? SourcePath { get; set; }

        public static void MapShaperClient(this WebApplication app)
        {
            app.MapGet("/client/{**path}", Dispatch);

#if DEBUG
            foreach (string dn in Brayns.Shaper.Application.SourcesPath)
            {
                if (File.Exists(dn + "/ShaperWeb.csproj") && Directory.Exists(dn + "/web"))
                {
                    SourcePath = dn;
                    SourcePath = SourcePath.Replace("\\", "/");
                    if (!SourcePath.EndsWith("/")) SourcePath += "/";
                    SourcePath += "web/";
                    break;
                }
            }
#endif
        }

        public static void MapShaperDefault(this WebApplication app)
        {
            app.MapGet("/", DispatchDefault);
        }

        private static void DispatchDefault(HttpContext ctx)
        {
            ctx.Response.Redirect("/client");
        }

        private static Stream? GetContent(string path)
        {
            if (SourcePath != null)
            {
                var fn = SourcePath + path;
                if (File.Exists(fn))
                    return new FileStream(fn, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
            }

            string resourceName = "ShaperWeb.web.";
            int n = path.LastIndexOf("/");
            if (n > -1)
            {
                resourceName += path.Substring(0, n).Replace("/", ".").Replace("-", "_");
                resourceName += "." + path.Substring(n + 1);
            }
            else
                resourceName += path;

            return Assembly.GetExecutingAssembly().GetManifestResourceStream(resourceName);
        }

        private static Stream? GetClientScript()
        {
            if (SourcePath != null)
            {
                DirectoryInfo di = new DirectoryInfo(SourcePath + "script");
                if (di.Exists)
                {
                    MemoryStream ms = new();

                    foreach (FileInfo fi in di.GetFiles("*.js", SearchOption.AllDirectories))
                    {
                        FileStream fs = new FileStream(fi.FullName, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
                        fs.CopyTo(ms);
                        fs.Close();

                        ms.WriteByte(13);
                        ms.WriteByte(10);
                    }

                    ms.Position = 0;
                    return ms;
                }
            }

            if (_minClient == null)
            {
                MemoryStream ms = new();

                foreach (string name in Assembly.GetExecutingAssembly().GetManifestResourceNames())
                {
                    if (name.StartsWith("ShaperWeb.web.script.") && name.EndsWith(".js"))
                    {
                        var st = Assembly.GetExecutingAssembly().GetManifestResourceStream(name);
                        st!.CopyTo(ms);
                        st!.Close();

                        ms.WriteByte(13);
                        ms.WriteByte(10);
                    }
                }

                string script = Encoding.UTF8.GetString(ms.ToArray());
                ms.Close();

                var res = NUglify.Uglify.Js(script, new NUglify.JavaScript.CodeSettings());

                _minClient = Encoding.UTF8.GetBytes(res.Code);
            }

            return new MemoryStream(_minClient);
        }

        private static async Task Dispatch(HttpContext ctx)
        {
            var path = ctx.Request.RouteValues["path"]?.ToString() ?? "index.html";

            Stream? content = null;

            if (path.ToLower() == "client.js")
                content = GetClientScript();
            else
                content = GetContent(path);

            if (content != null)
            {
                var mime = new FileExtensionContentTypeProvider();
                string? contentType;
                if (!mime.TryGetContentType(path, out contentType))
                    contentType = "application/other";

                ctx.Response.ContentType = contentType;

                await content.CopyToAsync(ctx.Response.Body);
                content.Close();
            }
            else
            {
                ctx.Response.StatusCode = 404;
            }
        }
    }
}
