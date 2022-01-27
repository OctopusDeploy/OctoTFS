using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json;
using NUnit.Framework;
using VerifyNUnit;

namespace OctoTFS.Tests
{
    [TestFixture]
    public class ContractStabilityFixture
    {
        [Test]
        [Description("This test helps to make sure we don't accidentally change the name nor data type of inputs people have stored in VSTS - otherwise they will likely lose data.")]
        public Task EnsureInputNamesAndTypesHaveNotChanged()
        {
            var taskJsonResourceNames = Assembly.GetAssembly(GetType())
                .GetManifestResourceNames()
                .Where(name => name.EndsWith("task.json"))
                .OrderBy(name => name)
                .ToArray();

            var toApprove = taskJsonResourceNames.Aggregate(new StringBuilder(), (builder, resourceName) =>
            {
                builder.AppendIndentedLine(resourceName);

                using var resourceStream = Assembly.GetAssembly(GetType()).GetManifestResourceStream(resourceName);
                using var textReader = new StreamReader(resourceStream);
                using var jsonReader = new JsonTextReader(textReader);
                dynamic task = JsonSerializer.CreateDefault().Deserialize(jsonReader);
                foreach (dynamic input in task.inputs)
                {
                    builder.AppendIndentedLine($"'{input.name}': {input.type}", 1);
                }

                return builder;
            }, builder => builder.ToString());

            return Verifier.Verify(toApprove);
        }
    }

    public static class StringBuilderExtensions
    {
        public static StringBuilder AppendIndentedLine(this StringBuilder builder, string append, int indent = 0)
        {
            return builder.Append(new string('\t', indent)).AppendLine(append);
        }
    }
}
