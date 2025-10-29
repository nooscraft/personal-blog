+++
title = "JAXB + Maven – Xml to Java"
date = 2013-09-02
[taxonomies]
categories = ["Programming"]
tags = ["java", "maven", "jaxb", "xml"]
+++

### Situation

Assume there's a situation where you want to generate Java sources from a xml schema definition (xsd).  And generate it constantly whenever you want it if the xsd's got updated.

### Solution

There are quiet a few out tools/libs out there but I found this particulate set (Maven and JAXB2) works well for me, just because it's pretty straight forward. But you may prefer a different approach.

### In to the action

Let's create a very basic maven project (assume you have already set up Maven and Java)

```
mvn archetype:generate -DgroupId={com.jaxb.hello} -DartifactId={HelloJAXB2}
 -DarchetypeArtifactId=maven-archetype-quickstart  -DinteractiveMode=false
```

Once the project is created open the pom.xml file in edit mode and add following two plugins

- [JAXB-2 Maven Plugin](http://mojo.codehaus.org/jaxb2-maven-plugin/)
- [Maven Source Plugin](http://maven.apache.org/plugins/maven-source-plugin/)

[Since this is a sample project you may have to define the maven ```<plugins />``` sections]

<img src="/public/images/plugins-section.png" alt="img" class="inline"/>

Carefully notice the sections

```<generatePackage>``` defines the place where you want to put the generated sources for the xsd's

```<schemaIncludes>``` defines the place where you place your .xsd files.

Now keep all that in mine lets see the project structure

<img src="/public/images/project-structure.png" alt="img" class="inline"/>

As you can see I just added a single .xsd to the location helloschema/

Once all these are in place you just have run the Maven target.

```mvn package```

<img src="/public/images/final-build.png" alt="img" class="inline"/>

[Here I have skipped the tests for the convenience]

If everything goes smoothly you'll see two .jar files in the target folder

<img src="/public/images/maven-build.png" alt="img" class="inline"/>

Sources are bundled in the ```HelloJAXB2-1.1-SNAPSHOT-sources.jar```

and you can find it also in ```generated-sources``` folder as well

<img src="/public/images/generated-sources.png" alt="img" class="inline"/>
