import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { DatabaseConstruct } from "../lib/constructs";

function assertExistingResources(): void {
  const app = new cdk.App();
  const stack = new cdk.Stack(app, "ExistingResourcesStack");
  const vpc = new ec2.Vpc(stack, "Vpc", { maxAzs: 2 });
  const secretArn =
    "arn:aws:secretsmanager:us-east-1:111111111111:secret:existing";
  const clusterEndpoint = "cluster.example.us-east-1.rds.amazonaws.com";
  const clusterReaderEndpoint =
    "cluster-ro.example.us-east-1.rds.amazonaws.com";
  const proxyArn =
    "arn:aws:rds:us-east-1:111111111111:db-proxy:prx-123";
  const proxyEndpoint = "proxy.example.us-east-1.rds.amazonaws.com";

  new DatabaseConstruct(stack, "Database", {
    resourcePrefix: "test",
    vpc,
    dbCredentialsSecretArn: secretArn,
    dbSecurityGroupId: "sg-0123456789abcdef0",
    proxySecurityGroupId: "sg-abcdef0123456789",
    dbClusterIdentifier: "existing-cluster",
    dbClusterEndpoint: clusterEndpoint,
    dbClusterReaderEndpoint: clusterReaderEndpoint,
    dbClusterPort: 5432,
    dbProxyName: "existing-proxy",
    dbProxyArn: proxyArn,
    dbProxyEndpoint: proxyEndpoint,
    manageSecurityGroupRules: false,
  });

  const template = Template.fromStack(stack);
  template.resourceCountIs("AWS::RDS::DBCluster", 0);
  template.resourceCountIs("AWS::RDS::DBProxy", 0);
  template.resourceCountIs("AWS::SecretsManager::Secret", 0);
}

function assertNewResources(): void {
  const app = new cdk.App();
  const stack = new cdk.Stack(app, "NewResourcesStack");
  const vpc = new ec2.Vpc(stack, "Vpc", { maxAzs: 2 });

  new DatabaseConstruct(stack, "Database", {
    resourcePrefix: "test",
    vpc,
    minCapacity: 0.5,
    maxCapacity: 1,
    databaseName: "testdb",
  });

  const template = Template.fromStack(stack);
  template.resourceCountIs("AWS::RDS::DBCluster", 1);
  template.resourceCountIs("AWS::RDS::DBProxy", 1);
  template.resourceCountIs("AWS::SecretsManager::Secret", 1);
}

function main(): void {
  assertExistingResources();
  assertNewResources();
  // eslint-disable-next-line no-console
  console.log("OK");
}

main();
